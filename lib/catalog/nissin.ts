import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  requireJan,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// 日清食品公式サイトの商品一覧ページと商品ページの HTML から栄養成分を機械的に読み取る。
// 商品一覧ページ 1 枚に全商品の番号・名前・カテゴリ（見出し）があり、栄養成分と希望小売価格は商品ページにある。
// robots.txt は無い（404）。商品ページは同時 4 件で取得する。

const BASE_URL = 'https://www.nissin.com/jp/product';

/** 商品ページを同時に取得する件数。 */
const FETCH_CONCURRENCY = 4;

/**
 * 集める商品カテゴリ（商品一覧ページの見出しの名前）。そのまま 1 食になる常温の食品に絞る。
 * 集めない見出しと理由:
 * - 冷凍・チルド（冷蔵）: 買える店とコーナーが違い、パスタ・お好み焼・つゆ・たれなど 1 食にならない物が混ざる
 * - 菓子（ビスケット・チョコレート菓子）・シリアル・発酵乳・乳酸菌飲料・ウェルネス・その他: 食事にならない
 */
export const NISSIN_CATEGORIES = [
  { slug: '即席麺', label: '即席麺（カップ麺・袋麺・焼そば）', role: 'main' },
  { slug: 'カップライス', label: 'カップライス', role: 'main' },
  { slug: 'スープ', label: 'スープ', role: 'side' },
] as const satisfies readonly CatalogCategory[];

/**
 * 栄養成分の単位。商品ページの見出し「栄養成分表示 [1食 (95g) 当たり]」の「1食」か「1玉」で、
 * どちらも 1 食分の値（3 食パックや 2 食入りの袋麺も 1 食あたりで載っている）。
 */
const SERVING_HEADING = /^1[食玉]\s*\(([\d.]+)g\)\s*当たり$/;

/** 希望小売価格は税別で載っている。食料品の軽減税率 8% を足して税込にする。 */
const TAX_RATE = 1.08;

/** 商品一覧ページの商品。 */
interface ListedProduct {
  id: string;
  name: string;
  category: string;
}

/**
 * 発売地域の表記のうち関東で買える物。「全国」「東日本」と、それに「(北海道を除く)」などが付いた物。
 * 除く地域に関東が含まれる物は買えない。地域限定（北海道・近畿・西日本・お土産コーナーなど）は買えない物とする。
 */
const KANTO_AREA = /^(?:全国|東日本)(?:\s*\(([^)]*)を除く\))?$/;

/** 商品ページから読み取った栄養成分と価格。 */
interface ProductDetail {
  area?: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  price?: number;
  jans?: string[];
}

/**
 * 商品一覧ページから、NISSIN_CATEGORIES に入る商品の番号・名前・カテゴリを読む。
 * 同じ商品が複数の見出しに載っていたら最初の見出しに入れる。
 */
export function parseProductList(html: string): ListedProduct[] {
  const products = new Map<string, ListedProduct>();
  let category = '';
  for (const match of html.matchAll(
    /<div class="Heading__inner"[^>]*>\s*([^<]*?)\s*<\/div>\s*<\/h2>|<a href="\/jp\/product\/items\/(\d+)\/"[^>]*>[\s\S]*?<div class="CardProducts__title">\s*([^<]*?)\s*<\/div>/g,
  )) {
    const [, heading, id, name] = match;
    if (heading !== undefined) {
      category = heading;
    } else if (
      id !== undefined &&
      name !== undefined &&
      !products.has(id) &&
      NISSIN_CATEGORIES.some((c) => c.slug === category)
    ) {
      products.set(id, { id, name: normalizeText(name), category });
    }
  }
  if (products.size === 0) throw new Error('商品の一覧が読み取れません');
  return [...products.values()];
}

/**
 * 商品ページの 1 食分の栄養成分と税込の希望小売価格。栄養成分を載せていない商品、
 * 味違いの詰め合わせで栄養成分が複数載っていて 1 食分が決まらない商品、
 * 関東で買えない商品（発売地域が地域限定）は undefined にする。
 * 発売地域の行が無い商品は地域を限っていないものとして扱う。
 * 栄養成分が載っているのに読めなければ、ページの形が変わったとみなして例外にする。
 *
 * 熱量・たんぱく質・脂質・炭水化物の行は、「めん・かやく」「スープ」に分かれていても
 * 先頭に 1 食分の合計が載っているので、その合計をそのまま使う。
 * 価格は 1 食入りの商品（内容量が 1 食の重さと同じ）だけ載せる。
 * 3 食パックなど複数食入りは希望小売価格がパック全体の値で、1 食分の価格が分からないため省く。
 * オープンプライスも省く。
 */
export function parseProductPage(html: string): ProductDetail | undefined {
  const area = /発売地域\s*<\/th>\s*<td>\s*([^<]*?)\s*<\/td>/.exec(html)?.[1];
  if (area !== undefined) {
    const excluded = KANTO_AREA.exec(area);
    if (excluded === null || excluded[1]?.includes('関東')) return undefined;
  }
  const headings = [...html.matchAll(/栄養成分表示\s*\[([^\]]*)\]/g)].map((m) =>
    normalizeText(m[1] ?? ''),
  );
  if (headings.length === 0) {
    if (html.includes('Table nutrition')) {
      throw new Error('栄養成分の見出しが読み取れません');
    }
    return undefined;
  }
  if (headings.length > 1) return undefined;
  const serving = SERVING_HEADING.exec(headings[0] ?? '')?.[1];
  if (serving === undefined) {
    throw new Error(`栄養成分の単位が読み取れません: ${headings[0]}`);
  }

  const nutrition = html.slice(html.indexOf('栄養成分表示'));
  const kcal = (label: string) =>
    toNumber(
      matchRequired(
        nutrition,
        new RegExp(
          `<th[^>]*>\\s*${label}\\s*</th>\\s*<td>\\s*([\\d.,]+)\\s*kcal`,
        ),
        label,
      ),
    );
  const grams = (label: string) =>
    toNumber(
      matchRequired(
        nutrition,
        new RegExp(`<th[^>]*>\\s*${label}\\s*</th>\\s*<td>\\s*([\\d.,]+)\\s*g`),
        label,
      ),
    );

  return {
    ...(area !== undefined && area !== '全国' && { area }),
    calories: kcal('熱量'),
    protein: grams('たんぱく質'),
    fat: grams('脂質'),
    carbs: grams('炭水化物'),
    ...priceOf(html, serving),
    ...janCodes(html),
  };
}

/** 商品ページの「JANコード」の行。行が無ければ無し。数字以外や桁数が違う値は例外にする。 */
function janCodes(html: string): { jans?: string[] } {
  const text = /JANコード\s*<\/th>\s*<td>\s*([^<]*?)\s*<\/td>/.exec(html)?.[1];
  if (text === undefined) return {};
  return { jans: [requireJan(text)] };
}

/** 1 食入りの商品の税込の希望小売価格。複数食入り・オープンプライス・価格の行が無い商品は空。 */
function priceOf(html: string, serving: string): { price?: number } {
  const text = /希望小売価格\s*<\/th>\s*<td>\s*([^<]*?)\s*<\/td>/.exec(
    html,
  )?.[1];
  if (text === undefined || text === 'オープンプライス') return {};
  const price = /^([\d,]+)円\s*\(税別\)$/.exec(text)?.[1];
  if (price === undefined)
    throw new Error(`希望小売価格が読み取れません: ${text}`);
  const content = matchRequired(
    html,
    /内容量[^<]*<\/th>\s*<td>\s*([\d.]+)g/,
    '内容量',
  );
  if (toNumber(content) !== toNumber(serving)) return {};
  return { price: Math.round(toNumber(price) * TAX_RATE) };
}

export async function scrapeNissin(): Promise<CatalogItem[]> {
  const products = parseProductList(await fetchText(`${BASE_URL}/items/`));
  const details = await mapConcurrent(products, FETCH_CONCURRENCY, (product) =>
    fetchText(`${BASE_URL}/items/${product.id}/`).then((html) => {
      try {
        return parseProductPage(html);
      } catch (error) {
        throw new Error(`${product.name} (${product.id}) の読み取りに失敗`, {
          cause: error,
        });
      }
    }),
  );
  const items = products.flatMap((product, index): CatalogItem[] => {
    const detail = details[index];
    if (detail === undefined) return [];
    return [
      {
        id: product.id,
        name: product.name,
        category: product.category,
        url: `${BASE_URL}/items/${product.id}/`,
        ...detail,
      },
    ];
  });
  return items;
}
