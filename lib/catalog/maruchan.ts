import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// 東洋水産（マルちゃん）公式サイトの商品検索 API から栄養成分を機械的に読み取る。
// 商品情報ページ（/products/category/<カテゴリ>/）は Vue で描画されており、中身は
// /products/api/searchproduct/?category=<カテゴリ> の JSON（商品ごとの栄養成分・希望小売価格・販売エリア・JAN コード）。
// robots.txt はこの API と商品ページを禁止していない。

const BASE_URL = 'https://www.maruchan.co.jp';

/**
 * 集める商品カテゴリ（公式サイトの商品検索のカテゴリ ID）。そのまま食べられる 1 食分になる物に絞る。
 * チルド麺・チルド食品・冷凍食品・魚肉ソーセージ・その他（調味料など）・水産加工品・業務用は
 * 調理が必要だったり、複数人前入りで 1 食分が分からなかったり、調味料で食事にならなかったりするので集めない。
 */
export const MARUCHAN_CATEGORIES = [
  { slug: 'instant-cupnoodles', label: 'カップ麺', role: 'main' },
  { slug: 'instant-noodles', label: '袋麺', role: 'main' },
  { slug: 'cooked-rice', label: 'パックご飯', role: 'main' },
  { slug: 'soup', label: 'スープ', role: 'side' },
] as const satisfies readonly CatalogCategory[];

/** 販売エリアがこの文字列なら全国で買える。 */
const NATIONWIDE_AREA = '全国';

/** 販売エリアの表記に関東が含まれる、または東日本全域（名古屋以東）を指す。 */
const KANTO_AREA = /関東|名古屋以東/;

/** 食品の軽減税率。希望小売価格は税抜で載っている。 */
const TAX_RATE = 1.08;

/** 商品検索 API の商品の文字列の項目。文字列でなければ API の形が変わったとみなして例外にする。 */
function requireString(product: unknown, key: string): string {
  const value = (product as Record<string, unknown>)[key];
  if (typeof value !== 'string') {
    throw new Error(`商品の ${key} が読み取れません`);
  }
  return value;
}

/** 栄養成分の行から値を取る。行頭から始まる行だけが 1 食分の合計で、字下げされた内訳（めん・かやく、スープ）は読まない。 */
function nutrient(nutrition: string, label: string, unit: string): number {
  return toNumber(
    matchRequired(
      nutrition,
      new RegExp(`^${label}:\\s*([\\d.,]+)\\s*${unit}$`, 'm'),
      label,
    ),
  );
}

/** 文字列の最初の「<数値>g」。 */
const firstGrams = (text: string, label: string) =>
  Number(matchRequired(text, /(\d+(?:\.\d+)?)g/, label));

/** JAN コード（8 桁か 13 桁の数字）。空なら無し。数字以外や桁数が違う値は例外にする。 */
function janCodes(product: unknown, name: string): { jans?: string[] } {
  const value = (product as Record<string, unknown>).product_jancode;
  if (value === null || value === '') return {};
  if (typeof value !== 'string' || !/^(?:\d{8}|\d{13})$/.test(value)) {
    throw new Error(
      `${name} の JAN コードが読み取れません: ${JSON.stringify(value)}`,
    );
  }
  return { jans: [value] };
}

/** 税込の希望小売価格（円）。オープン価格など数字でなければ無し。 */
const taxIncludedPrice = (price: string) =>
  /^\d+$/.test(price) ? Math.round(Number(price) * TAX_RATE) : undefined;

/**
 * 商品検索 API の応答のうち、category に入る関東で買える商品。
 * 栄養成分を載せていない商品（複数種のセット）と、複数食入りのパック（内容量が 1 食の量と違う。
 * 同じ中身の 1 食の商品が別にあり、希望小売価格も入り数分になる）は除く。
 * 栄養成分は商品ごとの 1 食分の合計の行（「エネルギー」など。めん・かやくとスープに分かれていても合計が載っている）を読む。
 * 栄養成分が載っているのに読めなければ、API の形が変わったとみなして例外にする。
 */
export function parseProductList(
  json: string,
  category: string,
): CatalogItem[] {
  const output = (JSON.parse(json) as { output?: unknown }).output;
  if (!Array.isArray(output)) throw new Error('商品の一覧が読み取れません');

  return output.flatMap((raw: unknown): CatalogItem[] => {
    // searchword_nutorition は栄養成分で、「エネルギー:412.000kcal」の行の並び（内訳の行は全角空白で字下げ）
    const nutrition = requireString(raw, 'searchword_nutorition');
    if (nutrition === '') return [];
    const area = normalizeText(requireString(raw, 'product_salesarea'));
    if (area !== NATIONWIDE_AREA && !KANTO_AREA.test(area)) return [];

    const name = normalizeText(requireString(raw, 'product_name'));
    // product_amount は内容量（複数食入りなら全体の量）、unit_quantity は栄養成分の対象（1食(96g)当たり）
    const amount = requireString(raw, 'product_amount');
    const unit = requireString(raw, 'unit_quantity');
    if (
      amount.includes('×') ||
      firstGrams(amount, `${name} の内容量`) !==
        firstGrams(unit, `${name} の栄養成分の対象`)
    ) {
      return [];
    }
    const price = taxIncludedPrice(requireString(raw, 'product_price'));
    return [
      {
        id: requireString(raw, 'product_code'),
        name,
        category,
        ...(price !== undefined && { price }),
        ...(area !== NATIONWIDE_AREA && { area }),
        url: requireString(raw, 'link_pc'),
        ...janCodes(raw, name),
        calories: nutrient(nutrition, 'エネルギー', 'kcal'),
        protein: nutrient(nutrition, 'たん白質', 'g'),
        fat: nutrient(nutrition, '脂質', 'g'),
        carbs: nutrient(nutrition, '炭水化物', 'g'),
      },
    ];
  });
}

export async function scrapeMaruchan(): Promise<CatalogItem[]> {
  const items = await mapConcurrent(MARUCHAN_CATEGORIES, 4, async ({ slug }) =>
    parseProductList(
      await fetchText(
        `${BASE_URL}/products/api/searchproduct/?category=${slug}`,
      ),
      slug,
    ),
  );
  return withoutSharedJans(items.flat());
}

/**
 * 公式サイトが複数の商品に同じ JAN コードを載せている場合（焼そばとスープ付焼そばなど）、
 * どの商品のバーコードか決まらないので、その JAN は全商品から外す。
 */
function withoutSharedJans(items: CatalogItem[]): CatalogItem[] {
  const counts = new Map<string, number>();
  for (const jan of items.flatMap((item) => item.jans ?? [])) {
    counts.set(jan, (counts.get(jan) ?? 0) + 1);
  }
  return items.map(({ jans, ...item }) => {
    const unique = (jans ?? []).filter((jan) => counts.get(jan) === 1);
    return unique.length > 0 ? { ...item, jans: unique } : item;
  });
}
