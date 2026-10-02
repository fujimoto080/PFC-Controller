import {
  assignBlocks,
  groupLines,
  joinLine,
  type PdfTextItem,
  readPdfPages,
} from './pdf.ts';
import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// 吉野家の栄養成分一覧 PDF（Excel から出力された表）を、文字の座標から表として組み立てて読み取る。
// 栄養成分は公式サイトの商品ページに載っていないため PDF だけが読み取り元で、
// カテゴリ・商品ページの URL・税込価格は、公式サイトのメニューページの商品と商品名で突き合わせて付ける。

const BASE_URL = 'https://www.yoshinoya.com';

const CONCURRENCY = 4;

const NUTRITION_PDF_URL = `${BASE_URL}/pdf/allergy/`;

/**
 * 集める商品カテゴリ。slug は公式サイトのメニューページ（/menu/<slug>）で、配列の順に商品を割り当てる。
 * 複数のカテゴリのメニューページに載る商品（鰻皿は「おかず」と「鰻重」など）は最初のカテゴリに入れる。
 * 「から揚げ」のメニューページは丼・定食・カレーと重なるので持たない。
 * お子様メニュー（kids）・牛丼・麺セット（menset）・期間限定（gentei。他のメニューページと重複）は集めない。
 */
export const YOSHINOYA_CATEGORIES = [
  { slug: 'gyudon', label: '牛丼', role: 'main' },
  { slug: 'yoshinoyanodon', label: '丼', role: 'main' },
  { slug: 'set', label: '定食', role: 'main' },
  { slug: 'curry', label: 'カレー', role: 'main' },
  { slug: 'yoshinomi', label: 'おかず（皿）', role: 'side' },
  { slug: 'unajyu', label: '鰻重', role: 'main' },
  { slug: 'morningset', label: '朝定食', role: 'main' },
  { slug: 'sidemenu', label: 'サイドメニュー', role: 'side' },
] as const satisfies readonly CatalogCategory[];

/**
 * 集めない商品名。組み合わせ提案が主食と副菜を組むので、単品を組み合わせたセット（お新香セット・牛丼・汁なし坦々セットなど）は除く。
 * ファミリーパックは複数人前なので除く。
 * PDF にあっても公式サイトの集めるメニューページに無い物（ドリンク・調味料・お子様セット・地域限定メニュー・
 * 牛丼のトッピング違い）は、商品名が合わないので集まらない。店内価格の無い持ち帰り専用の商品も集めない。
 */
const EXCLUDED_NAME_PATTERN = /セット|ファミリーパック/;

/** 栄養成分一覧の 1 行。size は表のサイズ欄（無い商品もある）。 */
export interface NutritionRow {
  name: string;
  size?: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** メニュー欄は x がこれ以上（これより左はカテゴリーの縦書き）。縦書き 1 文字のカテゴリーがメニュー欄の左端に寄ることがあるので 1 文字だけの物は除く。 */
const NAME_MIN_X = 185;
const VERTICAL_LABEL_MAX_X = 210;
/** サイズ欄はこれ以上（メニュー欄より右、数値の欄より左） */
const SIZE_MIN_X = 515;
/** 数値の欄は見出しの単位の位置からこれだけ左まで、アレルギー物質の欄の手前まで */
const VALUE_MARGIN_LEFT = 10;
const VALUE_MARGIN_RIGHT = 60;
/** サイズ欄の文字と数値の行の縦のずれの許容値（サイズ欄だけ少しずれて書かれている） */
const SIZE_TOLERANCE = 6;
/** メニュー欄の備考（※で始まる行）の続きの行は、この幅より右に字下げされている */
const NOTE_INDENT = 5;

/**
 * メニュー欄の文字から、結合セルごとの商品名と縦の中心を求める。
 * 結合セルは備考（※…）も含めた全体が縦の中心に書かれ、商品名が長いと次の行に（…）が続く。
 */
function readNameCells(
  items: readonly PdfTextItem[],
): { y: number; value: string }[] {
  const cells: {
    top: number;
    bottom: number;
    name: string;
    noteX?: number;
  }[] = [];
  const lines = groupLines(
    items.filter(
      (item) =>
        item.x >= NAME_MIN_X &&
        item.x < SIZE_MIN_X &&
        !(item.str.length === 1 && item.x < VERTICAL_LABEL_MAX_X),
    ),
  );
  for (const line of lines) {
    const text = joinLine(line);
    const x = line.items[0]?.x ?? 0;
    const last = cells.at(-1);
    if (last && text.startsWith('(')) {
      last.name += text;
      last.bottom = line.y;
    } else if (last && text.startsWith('※')) {
      last.noteX = x;
      last.bottom = line.y;
    } else if (last?.noteX !== undefined && x > last.noteX + NOTE_INDENT) {
      last.bottom = line.y;
    } else {
      cells.push({ top: line.y, bottom: line.y, name: text });
    }
  }
  return cells.map((cell) => ({
    y: (cell.top + cell.bottom) / 2,
    value: cell.name,
  }));
}

/**
 * 栄養成分一覧 PDF の 1 ページ分の文字から、表の行を組み立てる。
 * 日本語の表（見出しに「メニュー」と単位 (kcal)(g)(g)(g)(g) がある）だけを読み、英語・中国語・韓国語の表と表紙は空にする。
 * 数値の列は見出しの単位の位置で分ける。表の形が想定と違えば例外にする。
 */
export function parseNutritionPage(
  items: readonly PdfTextItem[],
): NutritionRow[] {
  const texts = items
    .map((item) => ({ ...item, str: normalizeText(item.str) }))
    .filter((item) => item.str !== '');
  const units = groupLines(texts).find(
    (line) => line.items[0]?.str === '(kcal)' && line.items.length === 5,
  );
  if (
    !units ||
    !texts.some((item) => item.str === 'メニュー' && item.y > units.y)
  ) {
    return [];
  }
  const unitXs = units.items.map((unit) => unit.x);
  const valueMinX = Math.min(...unitXs) - VALUE_MARGIN_LEFT;
  const valueMaxX = Math.max(...unitXs) + VALUE_MARGIN_RIGHT;
  const body = texts.filter((item) => item.y < units.y - 1);

  const rows = groupLines(
    body.filter((item) => item.x >= valueMinX && item.x < valueMaxX),
  ).map((line) => {
    const values = line.items.map((item) => {
      if (!/^[\d,]+(\.\d+)?$/.test(item.str)) {
        throw new Error(`栄養成分の数値が読み取れません: ${item.str}`);
      }
      return toNumber(item.str);
    });
    const columns = line.items.map(
      (item) =>
        unitXs.filter((unitX) => unitX - VALUE_MARGIN_LEFT <= item.x).length -
        1,
    );
    if (columns.join() !== '0,1,2,3,4') {
      throw new Error(`栄養成分の行が読み取れません: ${values.join(' ')}`);
    }
    const [calories, protein, fat, carbs] = values as [
      number,
      number,
      number,
      number,
    ];
    return { y: line.y, calories, protein, fat, carbs };
  });

  // サイズ欄は商品によって無い。備考（※…）や 2 行に分かれたサイズなど、どの行にも合わない文字は読み飛ばす。
  const sizeLines = groupLines(
    body.filter((item) => item.x >= SIZE_MIN_X && item.x < valueMinX),
  );
  const sizeOf = (row: { y: number }) =>
    sizeLines.find((line) => Math.abs(line.y - row.y) <= SIZE_TOLERANCE);

  return assignBlocks(rows, readNameCells(body), 'メニュー').map(
    ([{ y, ...row }, name]) => {
      const sizeLine = sizeOf({ y });
      return {
        name,
        ...(sizeLine === undefined ? {} : { size: joinLine(sizeLine) }),
        ...row,
      };
    },
  );
}

/** 公式サイトのメニューページ（カテゴリ）にある商品ページの URL。 */
export function parseMenuListPage(html: string): string[] {
  return [
    ...new Set(
      [
        ...html.matchAll(
          /<div class="menu__unit">\s*<a href="(https:\/\/www\.yoshinoya\.com\/menu\/[a-z0-9_-]+\/[a-z0-9_-]+\/)"/g,
        ),
      ].map((m) => m[1] ?? ''),
    ),
  ];
}

/**
 * 商品ページの商品名と、店内価格のサイズごとの税込価格（サイズの無い商品は size が空文字）。
 * 店内価格の無い持ち帰り専用の商品は prices が空。
 */
export function parseMenuPage(html: string): {
  name: string;
  prices: { size: string; price: number }[];
} {
  const name = matchRequired(html, /<h1>([^<]+)<\/h1>/, '商品名');
  matchRequired(html, /(tab__contents__(?:eatin|takeout))/, '価格表');
  const eatIn = /tab__contents__eatin[\s\S]*?(<ul>[\s\S]*?<\/ul>)/.exec(html);
  const prices = [
    ...(eatIn?.[1] ?? '').matchAll(
      /<div class="menu__price__wrapper">\s*(?:<div class="menu__label">([^<]*)<\/div>)?[\s\S]*?menu__price__taxin">([\d,]+)</g,
    ),
  ].map((m) => ({
    size: normalizeText(m[1] ?? ''),
    price: toNumber(m[2] ?? ''),
  }));
  if (eatIn && prices.length === 0) {
    throw new Error('店内価格が読み取れません');
  }
  return { name: normalizeText(name), prices };
}

/** 商品名の突き合わせ用の文字列。PDF は「納豆（タレ・カラシ・ネギ含む）」のように括弧書きを添えているので除く。 */
const nameKey = (name: string) =>
  normalizeText(name)
    .replaceAll(/\([^)]*\)/g, '')
    .replaceAll(' ', '');

interface MenuProduct {
  category: string;
  url: string;
  prices: Map<string, number>;
}

/** 商品名 → カテゴリ・商品ページの URL・サイズごとの価格 */
async function collectMenuProducts(): Promise<Map<string, MenuProduct>> {
  const urls = new Map<string, string>();
  for (const category of YOSHINOYA_CATEGORIES) {
    const html = await fetchText(`${BASE_URL}/menu/${category.slug}`);
    const found = parseMenuListPage(html);
    if (found.length === 0) {
      throw new Error(`${category.label}のメニューに商品が見つかりません`);
    }
    for (const url of found) {
      if (!urls.has(url)) urls.set(url, category.slug);
    }
  }
  const pages = await mapConcurrent([...urls], CONCURRENCY, async ([url]) => ({
    url,
    ...parseMenuPage(await fetchText(url)),
  }));
  const products = new Map<string, MenuProduct>();
  for (const page of pages) {
    if (page.prices.length === 0) continue;
    const key = nameKey(page.name);
    if (products.has(key)) continue;
    products.set(key, {
      category: urls.get(page.url) ?? '',
      url: page.url,
      prices: new Map(page.prices.map((p) => [p.size, p.price])),
    });
  }
  return products;
}

export async function scrapeYoshinoya(): Promise<CatalogItem[]> {
  const pages = await readPdfPages(NUTRITION_PDF_URL);
  const rows = pages.flatMap(parseNutritionPage);
  const products = await collectMenuProducts();
  return rows.flatMap((row) => {
    if (EXCLUDED_NAME_PATTERN.test(row.name)) return [];
    const product = products.get(nameKey(row.name));
    if (product === undefined) return [];
    const name = row.size === undefined ? row.name : `${row.name} ${row.size}`;
    const price = product.prices.get(row.size ?? '');
    return [
      {
        id: name,
        name,
        category: product.category,
        ...(price === undefined ? {} : { price }),
        url: product.url,
        calories: row.calories,
        protein: row.protein,
        fat: row.fat,
        carbs: row.carbs,
      },
    ];
  });
}
