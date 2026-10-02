import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
  requireJan,
  withoutSharedJans,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// 明星食品公式サイトの商品 API から栄養成分を機械的に読み取る。
// 商品情報ページ（/products/category/<カテゴリ>/）は Vue で描画されており、中身は
// /api/v1.1/ja_jp/products/list（小カテゴリごとの商品一覧）と、商品ごとの /api/v1/ja_jp/products/detail?id=<商品番号>
// （栄養成分・希望小売価格・販売エリア・JAN コード入り）の JSON。robots.txt は無い（404）。商品の詳細は同時 4 件で取得する。

const BASE_URL = 'https://www.myojofoods.co.jp';

/** 商品の詳細を同時に取得する件数。 */
const FETCH_CONCURRENCY = 4;

/**
 * 集める商品カテゴリ（公式サイトの小カテゴリ）。そのまま食べられる 1 食分になる常温の食品に絞る。
 * 公式サイトにはこの小カテゴリ以外の商品は載っていない（菓子・調味料・業務用・チルドは扱っていない）。
 */
export const MYOJO_CATEGORIES = [
  { slug: 'regular', label: 'カップ麺', role: 'main' },
  { slug: 'big', label: 'カップ麺（ビッグ）', role: 'main' },
  { slug: 'yakisoba', label: 'カップ焼そば', role: 'main' },
  { slug: 'yakisoba_big', label: 'カップ焼そば（ビッグ）', role: 'main' },
  { slug: 'noodle', label: '袋麺', role: 'main' },
  { slug: 'soup', label: 'スープ', role: 'side' },
] as const satisfies readonly CatalogCategory[];

/** 販売エリアがこの文字列なら全国で買える。 */
const NATIONWIDE_AREA = '全国';

/** 販売エリアの表記に関東か東日本が含まれる。 */
const KANTO_AREA = /関東|東日本/;

/** 希望小売価格は税別で載っている。食料品の軽減税率 8% を足して税込にする。 */
const TAX_RATE = 1.08;

/** API の応答の文字列の項目。文字列でなければ API の形が変わったとみなして例外にする。 */
function requireString(value: unknown, key: string): string {
  const field = (value as Record<string, unknown>)[key];
  if (typeof field !== 'string') {
    throw new Error(`商品の ${key} が読み取れません`);
  }
  return field;
}

/** 商品一覧 API の応答の商品番号。 */
export function parseProductIds(json: string): string[] {
  const products = (JSON.parse(json) as { products?: unknown }).products;
  if (!Array.isArray(products)) throw new Error('商品の一覧が読み取れません');
  return products.map((product: unknown) => {
    const id = (product as { id?: unknown }).id;
    if (typeof id !== 'number') throw new Error('商品の id が読み取れません');
    return String(id);
  });
}

/**
 * 商品の詳細 API の応答から 1 食分の栄養成分と税込の希望小売価格を読む。
 * 栄養成分を載せていない商品と、関東で買えない商品（販売エリアが地域限定）は undefined にする。
 * 栄養成分が載っているのに読めなければ、API の形が変わったとみなして例外にする。
 *
 * 熱量などの項目は、「めん・かやく」「スープ」に分かれていても先頭の項目が 1 食分の合計
 * （内訳は child に入っている）なので、その合計をそのまま使う。
 * 3 食パックなど複数食入りも栄養成分は 1 食あたりで載っているが、希望小売価格はパック全体の値で
 * 1 食分の価格が分からないため省く。オープン価格も省く。
 */
export function parseProductDetail(
  json: string,
  category: string,
): CatalogItem | undefined {
  const detail = JSON.parse(json) as unknown;
  const area = normalizeText(requireString(detail, 'sales_area'));
  if (area !== NATIONWIDE_AREA && !KANTO_AREA.test(area)) return undefined;

  const nutrition = (detail as { nutrition?: unknown }).nutrition;
  if (!Array.isArray(nutrition)) {
    throw new Error('商品の nutrition が読み取れません');
  }
  if (nutrition.length === 0) return undefined;

  const label = normalizeText(requireString(detail, 'nutrition_label'));
  if (!/\[1[食玉] \(/.test(label)) {
    throw new Error(`栄養成分の単位が読み取れません: ${label}`);
  }
  const amountOf = (name: string, unit: string) => {
    const row = (nutrition as unknown[]).find(
      (n) => (n as { name?: unknown }).name === name,
    );
    return toNumber(
      matchRequired(
        row === undefined ? '' : requireString(row, 'amount'),
        new RegExp(`^([\\d.,]+)${unit}$`),
        name,
      ),
    );
  };

  const rawPrice = requireString(detail, 'price');
  const packs = normalizeText(requireString(detail, 'number_of_products'));
  const price =
    packs === '' && /^\d+$/.test(rawPrice)
      ? Math.round(Number(rawPrice) * TAX_RATE)
      : undefined;
  const id = String((detail as { id: unknown }).id);
  const jan = normalizeText(requireString(detail, 'jan'));

  return {
    id,
    name: normalizeText(requireString(detail, 'name')),
    category,
    ...(price !== undefined && { price }),
    ...(area !== NATIONWIDE_AREA && { area }),
    url: `${BASE_URL}/products/items/${id}/`,
    ...(jan !== '' && { jans: [requireJan(jan)] }),
    calories: amountOf('熱量', 'kcal'),
    protein: amountOf('たんぱく質', 'g'),
    fat: amountOf('脂質', 'g'),
    carbs: amountOf('炭水化物', 'g'),
  };
}

export async function scrapeMyojo(): Promise<CatalogItem[]> {
  const listed = await mapConcurrent(
    MYOJO_CATEGORIES,
    FETCH_CONCURRENCY,
    async ({ slug }) =>
      parseProductIds(
        await fetchText(
          `${BASE_URL}/api/v1.1/ja_jp/products/list?company=myojofoods&subcategory=${slug}&page=1&is_official=true`,
        ),
      ).map((id) => ({ id, category: slug })),
  );
  const products = listed.flat();
  const items = await mapConcurrent(
    products,
    FETCH_CONCURRENCY,
    ({ id, category }) =>
      fetchText(`${BASE_URL}/api/v1/ja_jp/products/detail?id=${id}`).then(
        (json) => {
          try {
            return parseProductDetail(json, category);
          } catch (error) {
            throw new Error(`商品 ${id} の読み取りに失敗`, { cause: error });
          }
        },
      ),
  );
  return withoutSharedJans(items.filter((item) => item !== undefined));
}
