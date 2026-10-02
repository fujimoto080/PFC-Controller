import {
  assignBlocks,
  byTop,
  groupLines,
  joinLine,
  type PdfTextItem,
  readPdfPages,
  SAME_LINE,
} from './pdf.ts';
import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// すき家の栄養成分一覧 PDF（Excel から出力された表）を、文字の座標から表として組み立てて読み取る。
// 価格は PDF に無いため、店内メニューの商品ページから商品名とサイズが一致するものを付ける。

const BASE_URL = 'https://www.sukiya.jp';

const CONCURRENCY = 4;

const NUTRITION_PDF_URL =
  'https://images.zensho.co.jp/materials/sukiya/allergen/nutrition.pdf';

/** 価格を集める店内メニューのカテゴリ（公式サイトの URL の slug）。お子様メニュー・ドリンクは集めないので含めない。 */
const MENU_CATEGORIES = [
  'gyudon',
  'unagi',
  'curry',
  'karubi',
  'don',
  'morning',
  'dinner',
  'special',
  'oshokujisalad',
  'side',
];

/**
 * 集める商品カテゴリ。label は PDF のカテゴリー欄の表記。
 * お子様メニュー・すきすきセット（お子様向けのセット）・ドリンク・デザートは 1 食の主食や副菜にならないため含めない。
 */
export const SUKIYA_CATEGORIES = [
  { slug: 'gyudon', label: '牛丼', role: 'main' },
  { slug: 'gyudon-light', label: '牛丼ライト', role: 'main' },
  { slug: 'curry', label: 'カレー', role: 'main' },
  { slug: 'kodawari', label: 'こだわり丼', role: 'main' },
  { slug: 'unagi', label: 'うなぎ', role: 'main' },
  { slug: 'oshokuji-salad', label: 'お食事サラダ', role: 'main' },
  { slug: 'teishoku', label: '定食', role: 'main' },
  { slug: 'morning', label: '朝食', role: 'main' },
  { slug: 'yorusuki', label: '夜すき', role: 'main' },
  { slug: 'ippin', label: '一品', role: 'side' },
] as const satisfies readonly CatalogCategory[];

/** PDF にあっても集めないカテゴリー。これ以外の見知らぬカテゴリーはページの形が変わったとみなして例外にする。 */
const EXCLUDED_CATEGORY_LABELS = new Set([
  'お子様メニュー',
  'すきすきセット',
  'ドリンク・デザート',
]);

/**
 * 集めない商品名。組み合わせ提案が主食と副菜を組むので、単品を組み合わせたセット（サラダセット・Wセットなど）は除く。
 * 持ち帰り専用の商品と、主食のカテゴリーに載っている追加のソースも除く。
 */
const EXCLUDED_NAME_PATTERN = /セット|テイクアウト|ソース/;

/** 栄養成分一覧の 1 行。size は表のサイズ欄（無い商品もある）。 */
export interface NutritionRow {
  category: string;
  name: string;
  size?: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** カテゴリー欄はこれより左、サイズ欄はこれより右（数値の欄より左）。間がメニュー欄。 */
const CATEGORY_MAX_X = 90;
const SIZE_MIN_X = 200;
/** 縦書きのカテゴリーで 1 つの見出しとみなす文字の間隔 */
const VERTICAL_CHAR_GAP = 30;

/**
 * 栄養成分一覧 PDF の 1 ページ分の文字から、表の行を組み立てる。
 * 数値の列は見出しの単位（(kcal), (g)）の位置で分ける。表の形が想定と違えば例外にする。
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
  if (!units) throw new Error('栄養成分の見出しが読み取れません');
  const valueMinX = Math.min(...units.items.map((unit) => unit.x));
  const body = texts.filter((item) => item.y < units.y - SAME_LINE);

  const sizeLines = groupLines(
    body.filter((item) => item.x >= SIZE_MIN_X && item.x < valueMinX),
  );
  const rows = groupLines(body.filter((item) => item.x >= valueMinX)).map(
    (line) => {
      const values = line.items.map((item) => {
        if (!/^\d+(\.\d+)?$/.test(item.str)) {
          throw new Error(`栄養成分の数値が読み取れません: ${item.str}`);
        }
        return toNumber(item.str);
      });
      const columns = line.items.map(
        (item) => units.items.filter((unit) => unit.x <= item.x).length - 1,
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
      const sizeLine = sizeLines.find(
        (size) => Math.abs(size.y - line.y) <= SAME_LINE,
      );
      return {
        y: line.y,
        ...(sizeLine === undefined ? {} : { size: joinLine(sizeLine) }),
        calories,
        protein,
        fat,
        carbs,
      };
    },
  );
  const lastRow = rows.at(-1);
  if (lastRow === undefined) return [];
  const orphanSize = sizeLines.find(
    (size) => !rows.some((row) => Math.abs(size.y - row.y) <= SAME_LINE),
  );
  if (orphanSize) {
    throw new Error(`サイズ「${joinLine(orphanSize)}」の行がありません`);
  }

  const named = assignBlocks(
    rows,
    groupLines(
      body.filter((item) => item.x > CATEGORY_MAX_X && item.x < SIZE_MIN_X),
    ).map((line) => ({ y: line.y, value: joinLine(line) })),
    'メニュー',
  ).map(([row, name]) => ({ ...row, name }));

  // カテゴリー欄は縦書き（1 文字ずつ縦に並ぶ）か横書き 1 行。近い文字を 1 つの見出しにまとめる。
  const categoryLabels: { top: number; bottom: number; value: string }[] = [];
  for (const item of body
    .filter(
      (item) => item.x <= CATEGORY_MAX_X && item.y > lastRow.y - SAME_LINE,
    )
    .sort(byTop)) {
    const label = categoryLabels.at(-1);
    if (label && label.bottom - item.y < VERTICAL_CHAR_GAP) {
      label.bottom = item.y;
      label.value += item.str;
    } else {
      categoryLabels.push({ top: item.y, bottom: item.y, value: item.str });
    }
  }
  return assignBlocks(
    named,
    categoryLabels.map((label) => ({
      y: (label.top + label.bottom) / 2,
      value: label.value,
    })),
    'カテゴリー',
  ).map(([{ y: _y, ...row }, category]) => ({ category, ...row }));
}

/** 店内メニューのカテゴリ一覧ページにある商品ページの URL。 */
export function parseMenuListPage(html: string): string[] {
  return [
    ...new Set(
      [...html.matchAll(/href="(\/menu\/in\/[a-z_]+\/\d+\/index\.html)"/g)].map(
        (m) => `${BASE_URL}${m[1] ?? ''}`,
      ),
    ),
  ];
}

/** 店内メニューの商品ページの商品名と、サイズごとの税込価格（サイズの無い商品は size が空文字）。 */
export function parseMenuPage(html: string): {
  name: string;
  prices: { size: string; price: number }[];
} {
  // コメントアウトされた古い価格表が残っているので除く
  const body = html.replaceAll(/<!--[\s\S]*?-->/g, '');
  const name = matchRequired(
    body,
    /<h2 class="pro_page_title media_pc">([\s\S]*?)<\/h2>/,
    '商品名',
  ).replaceAll(/<br\s*\/?>/g, '');
  const prices = [
    ...body.matchAll(
      /<div class="size">([^<]*)<\/div>\s*<div class="price">\s*<span>([\d,]+)<\/span>円/g,
    ),
  ].map((m) => ({
    size: normalizeText(m[1] ?? ''),
    price: toNumber(m[2] ?? ''),
  }));
  return { name: normalizeText(name), prices };
}

/** 商品名の表記ゆれ（波ダッシュ・空白）を揃えた突き合わせ用の文字列。 */
const nameKey = (name: string) =>
  normalizeText(name)
    .replaceAll(/[~〜～]/g, '~')
    .replaceAll(' ', '');

/**
 * サイズの突き合わせ用の文字列。商品ページは「ごはん大盛」「お肉並盛」「特盛（肉2倍ごはん大盛）」のように
 * 量を変える物や中身を書き添えているが、PDF は「大盛」「並盛」「特盛」なので、前置きと括弧書きを除く。
 */
const sizeKey = (size: string) =>
  normalizeText(size)
    .replace(/\([^)]*\)$/, '')
    .replace(/^(\(肉\)|お肉|ごはん)/, '');

/** 商品名 → 商品ページの URL とサイズごとの価格 */
type MenuIndex = Map<string, { url: string; prices: Map<string, number> }>;

async function collectMenuIndex(): Promise<MenuIndex> {
  const urls = new Set<string>();
  for (const category of MENU_CATEGORIES) {
    const html = await fetchText(`${BASE_URL}/menu/in/${category}/`);
    for (const url of parseMenuListPage(html)) urls.add(url);
  }
  if (urls.size === 0) throw new Error('店内メニューの商品が見つかりません');
  const pages = await mapConcurrent([...urls], CONCURRENCY, async (url) => ({
    url,
    ...parseMenuPage(await fetchText(url)),
  }));
  // 複数のカテゴリに載る商品は最初のページを使う
  const index: MenuIndex = new Map();
  for (const page of pages) {
    const key = nameKey(page.name);
    if (index.has(key)) continue;
    index.set(key, {
      url: page.url,
      prices: new Map(page.prices.map((p) => [sizeKey(p.size), p.price])),
    });
  }
  return index;
}

/** 栄養成分一覧 PDF の全ページの表の行。 */
async function readNutritionRows(): Promise<NutritionRow[]> {
  const pages = await readPdfPages(NUTRITION_PDF_URL);
  return pages.flatMap(parseNutritionPage);
}

export async function scrapeSukiya(): Promise<CatalogItem[]> {
  const rows = await readNutritionRows();
  const menu = await collectMenuIndex();
  const slugByLabel = new Map<string, string>(
    SUKIYA_CATEGORIES.map((category) => [category.label, category.slug]),
  );
  return rows.flatMap((row) => {
    if (EXCLUDED_CATEGORY_LABELS.has(row.category)) return [];
    const category = slugByLabel.get(row.category);
    if (category === undefined) {
      throw new Error(`知らないカテゴリー「${row.category}」があります`);
    }
    if (EXCLUDED_NAME_PATTERN.test(row.name)) return [];
    const name = row.size === undefined ? row.name : `${row.name} ${row.size}`;
    const page = menu.get(nameKey(row.name));
    const price = page?.prices.get(sizeKey(row.size ?? ''));
    return [
      {
        id: name,
        name,
        category,
        ...(price === undefined ? {} : { price }),
        url: page?.url ?? NUTRITION_PDF_URL,
        calories: row.calories,
        protein: row.protein,
        fat: row.fat,
        carbs: row.carbs,
      },
    ];
  });
}
