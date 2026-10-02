import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// 明治公式サイトの商品情報ページ（ザバスのスポーツ栄養、ヨーグルト）の HTML から栄養成分を機械的に読み取る。
// カテゴリページ（/products/<カテゴリ>/）に小見出しごとの商品の一覧があり、栄養成分は商品ページにある。
// 商品ページの名前（/products/sports/4902777351810.html の数字）がその商品の JAN コードなので、jans に入れる。
// 商品ページには価格が載っていない（メーカー希望小売価格を公開していない）ので、価格は付けない。
// robots.txt は /takuhaimeiji/mailmagazine/ だけを禁止している。商品ページは同時 4 件で取得する。

const BASE_URL = 'https://www.meiji.co.jp';

/** 商品ページを同時に取得する件数。 */
const FETCH_CONCURRENCY = 4;

/**
 * 集める商品カテゴリ。1 本・1 個で飲み食べできる、たんぱく質を補う物に絞って副菜とする。
 * - savas: ザバスのプロテイン飲料・ゼリー・ヨーグルト・粉末の 1 袋入りトライアル
 * - protein-bar: ザバスのプロテインバー
 * - protein-powder: ザバスの粉末プロテイン。栄養成分が「1食分（○g）」で載っている物を 1 回分として、サイズ違いを 1 件にまとめて集める
 * - yogurt: 明治ブルガリアヨーグルト・プロビオヨーグルトなど、1 個・1 本で食べる個食ヨーグルト
 *
 * 集めない物と理由:
 * - 栄養成分が 100g（100ml）あたりだけの物（大容量ヨーグルト、のむヨーグルト）: 内容量から換算しない
 * - 粉末プロテインのうち「2食分」で載っている物（ジュニアプロテイン）: 1 回分が分からない
 * - たんぱく質などが「15.0～19.0g」のように幅で載っている物（BIOPRO の飲料など）: 値が決まらない
 * - ザバス ウォーター・ヴァーム（アミノ酸飲料）: たんぱく質を含まない
 * - グッズ（シェイカー・ボトル）: 食品ではない
 * - 宅配専用の発酵乳: 店で買えない
 * - 牛乳・乳飲料・チーズ・菓子・チョコレート・アイス・乳児・幼児用・医療用（流動食など）・サプリメント:
 *   たんぱく質を補う 1 本・1 個の商品ではない、または大容量で 1 回分が分からない
 * - 「高たんぱく」をうたう TANPACT のシリーズ: 公式サイトの商品情報に載っていない
 */
export const MEIJI_CATEGORIES = [
  { slug: 'savas', label: 'ザバス（飲料・ヨーグルト・ゼリー）', role: 'side' },
  { slug: 'protein-bar', label: 'プロテインバー', role: 'side' },
  { slug: 'protein-powder', label: 'プロテイン粉末（1食分）', role: 'side' },
  { slug: 'yogurt', label: 'ヨーグルト', role: 'side' },
] as const satisfies readonly CatalogCategory[];

/** カテゴリページ。exclude は集めない小見出し（理由は MEIJI_CATEGORIES のコメント）。表記は normalizeText 後（半角括弧）。 */
const SOURCES = [
  {
    path: 'sports',
    exclude: [
      'ザバス ウォーター',
      'ザバス(グッズ)',
      'ヴァーム',
      'ヴァームプレミアム',
    ],
  },
  { path: 'yogurt', exclude: ['宅配商品(発酵乳)'] },
  { path: 'probioticsyogurt', exclude: ['宅配商品(発酵乳)'] },
] as const;

/** プロテインバーの小見出し。 */
const PROTEIN_BAR_SECTION = 'ザバス プロテインバー';

/** 商品一覧ページの商品。id は商品ページの名前で、その商品の JAN コード（8 桁か 13 桁の数字）。 */
interface ListedProduct {
  id: string;
  path: string;
  section: string;
}

/** 商品ページから読み取った 1 個・1 本・1 食分の栄養成分。 */
interface ProductDetail {
  name: string;
  /** 栄養成分の単位が「1食分」（粉末プロテインの 1 回分）。 */
  portion: boolean;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** 栄養成分表示の単位。「1個（112g）」「1本分（300ml）」「1食分（28g）」など。 */
const UNIT_HEADING = /^1(個|本分?|カップ|袋|食分)\(([^)]+)\)あたり$/;

/** 栄養成分が 100g（100ml）あたり、または「2食分」など 1 個・1 回分でない物。集めない。 */
const NOT_PER_UNIT_HEADING = /^(?:100(?:g|ml)あたり|[2-9]食分.*)$/;

/**
 * カテゴリページの HTML から、小見出し（h2）ごとの商品ページを読む。
 * exclude の小見出しの商品は除く。同じ商品が複数の小見出しに載っていたら最初の小見出しに入れる。
 */
export function parseProductList(
  html: string,
  exclude: readonly string[],
): ListedProduct[] {
  const products = new Map<string, ListedProduct>();
  let section = '';
  for (const match of html.matchAll(
    /<h2 id="category\d+"[^>]*>([\s\S]*?)<\/h2>|<a href="(\/products\/[^"/]+\/([^"/]+)\.html)" class="l-card"[^>]*>/g,
  )) {
    const [, heading, path, id] = match;
    if (heading !== undefined) {
      section = normalizeText(heading.replace(/<[^>]+>/g, ''));
    } else if (
      path !== undefined &&
      id !== undefined &&
      !products.has(id) &&
      !exclude.includes(section)
    ) {
      if (!/^(?:\d{8}|\d{13})$/.test(id)) {
        throw new Error(`商品ページの名前が JAN コードではありません: ${path}`);
      }
      products.set(id, { id, path, section });
    }
  }
  if (products.size === 0) throw new Error('商品の一覧が読み取れません');
  return [...products.values()];
}

/** 栄養成分表の行の値。「15.0～19.0g」のように幅で載っている行は undefined（値が決まらない）。 */
function nutrient(
  table: string,
  label: string,
  unit: string,
): number | undefined {
  const value = matchRequired(
    table,
    new RegExp(
      `<th[^>]*>\\s*${label}\\s*</th>\\s*<td[^>]*>\\s*([\\d.,]+(?:\\s*[～〜~]\\s*[\\d.,]+)?)\\s*${unit}\\s*</td>`,
    ),
    label,
  );
  return /[～〜~]/.test(value) ? undefined : toNumber(value);
}

/**
 * 商品ページの栄養成分。栄養成分を載せていない商品（グッズ）と、
 * 100g（100ml）あたりや「2食分」で載っていて 1 個・1 本・1 回分が分からない商品、
 * たんぱく質などが「15.0～19.0g」のように幅で載っていて値が決まらない商品は undefined にする。
 * 栄養成分が載っているのに読めなければ、ページの形が変わったとみなして例外にする。
 *
 * 粉末プロテインは「1食分（28g）」の値で、袋のサイズ（800g・450g など）が違っても同じなので、
 * 名前から袋のサイズを除いて「1食分(28g)」を付ける（scrapeMeiji でサイズ違いを 1 件にまとめる）。
 */
export function parseProductPage(html: string): ProductDetail | undefined {
  const headings = [
    ...html.matchAll(/<h2 class="m-heading2">栄養成分表示\s*([^<]*)<\/h2>/g),
  ].map((m) => normalizeText(m[1] ?? ''));
  if (headings.length === 0) return undefined;
  if (headings.length > 1) throw new Error('栄養成分が複数載っています');
  const heading = headings[0] ?? '';
  if (NOT_PER_UNIT_HEADING.test(heading)) return undefined;
  const unit = UNIT_HEADING.exec(heading);
  if (unit === null) {
    throw new Error(`栄養成分の単位が読み取れません: ${heading}`);
  }

  const name = normalizeText(
    matchRequired(html, /<h1[^>]*>([\s\S]*?)<\/h1>/, '商品名').replace(
      /<span[\s\S]*?<\/span>/g,
      '',
    ),
  );
  const table = matchRequired(
    html.slice(html.indexOf('栄養成分表示')),
    /(<table[\s\S]*?<\/table>)/,
    '栄養成分表',
  );
  const calories = nutrient(table, 'エネルギー', 'kcal');
  const protein = nutrient(table, 'たんぱく質', 'g');
  const fat = nutrient(table, '脂質', 'g');
  const carbs = nutrient(table, '炭水化物', 'g');
  if (
    calories === undefined ||
    protein === undefined ||
    fat === undefined ||
    carbs === undefined
  ) {
    return undefined;
  }
  const portion = unit[1] === '食分';
  return {
    name: portion
      ? `${name.replace(/\s*[\d,.]+g$/, '')} ${heading.replace('あたり', '')}`
      : name,
    portion,
    calories,
    protein,
    fat,
    carbs,
  };
}

/** 商品のカテゴリ。ヨーグルトのページはヨーグルト、ザバスはプロテインバー・粉末（1食分）・それ以外に分ける。 */
function categoryOf(
  source: string,
  section: string,
  portion: boolean,
): (typeof MEIJI_CATEGORIES)[number]['slug'] {
  if (source !== 'sports') return 'yogurt';
  if (section === PROTEIN_BAR_SECTION) return 'protein-bar';
  return portion ? 'protein-powder' : 'savas';
}

export async function scrapeMeiji(): Promise<CatalogItem[]> {
  const listed = (
    await mapConcurrent(SOURCES, FETCH_CONCURRENCY, async (source) =>
      parseProductList(
        await fetchText(`${BASE_URL}/products/${source.path}/`),
        source.exclude,
      ).map((product) => ({ ...product, source: source.path })),
    )
  ).flat();
  // ヨーグルトのページ同士で同じ商品が載っていたら最初の 1 件にする
  const products = [...new Map(listed.map((p) => [p.id, p])).values()];
  const details = await mapConcurrent(products, FETCH_CONCURRENCY, (product) =>
    fetchText(`${BASE_URL}${product.path}`).then((html) => {
      try {
        return parseProductPage(html);
      } catch (error) {
        throw new Error(`${product.path} の読み取りに失敗`, { cause: error });
      }
    }),
  );
  // 粉末プロテインはサイズ違いを 1 件にまとめるので、ID はサイズを除いた名前にし、最初のサイズの商品ページを URL にする
  const items = new Map<string, CatalogItem>();
  products.forEach((product, index) => {
    const detail = details[index];
    if (detail === undefined) return;
    const { portion, ...nutrition } = detail;
    const id = portion ? detail.name : product.id;
    const merged = items.get(id);
    if (merged) {
      merged.jans?.push(product.id);
      if (
        (['calories', 'protein', 'fat', 'carbs'] as const).some(
          (key) => merged[key] !== nutrition[key],
        )
      ) {
        throw new Error(`${id} のサイズ違いで栄養成分が異なります`);
      }
      return;
    }
    items.set(id, {
      id,
      category: categoryOf(product.source, product.section, portion),
      url: `${BASE_URL}${product.path}`,
      jans: [product.id],
      ...nutrition,
    });
  });
  const result = [...items.values()];
  const jans = result.flatMap((item) => item.jans ?? []);
  if (new Set(jans).size !== jans.length) {
    throw new Error('同じ JAN コードが複数の商品にあります');
  }
  return result;
}
