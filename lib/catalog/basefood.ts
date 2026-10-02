import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// ベースフード公式通販サイトの商品一覧ページと商品ページから栄養成分を機械的に読み取る。
// サイトは Next.js で、商品一覧ページに商品ページへのリンク、商品ページの RSC ペイロードに
// 商品情報（名前・SKU・単品の通常価格）と栄養成分表示の表がある。全国に通販する商品なので scope は付けない。
// robots.txt は全面許可（shop.basefood.co.jp では 404）。商品ページは同時 4 件で取得する。

const BASE_URL = 'https://shop.basefood.co.jp';

/** 商品ページを同時に取得する件数。 */
const FETCH_CONCURRENCY = 4;

/**
 * 集める商品カテゴリ（商品ページ URL の /products/ に続く、商品名を除いた部分）。そのまま 1 食になる主食に絞る。
 * 集めない商品と理由:
 * - BASE Cookies・BASE Pound Cake: 菓子で 1 食にならない
 * - BASE Pancake Mix: 栄養成分が卵と牛乳を足して調理した後の値で、商品単体の値ではない
 * - 定期購入の商品（/products/subscription/）: 単品の商品の定期コースで、単品の通常価格が無い
 */
export const BASEFOOD_CATEGORIES = [
  { slug: 'basebread', label: 'BASE BREAD', role: 'main' },
  { slug: 'lite', label: 'LITE シリーズ', role: 'main' },
  { slug: 'deli/baseramen', label: 'BASE RAMEN', role: 'main' },
  { slug: 'deli/baseyakisoba', label: 'BASE YAKISOBA', role: 'main' },
] as const satisfies readonly CatalogCategory[];

/** 商品一覧ページの商品ページへのリンクのうち、BASEFOOD_CATEGORIES に入る商品の URL のパスとカテゴリ。 */
export function parseProductLinks(
  html: string,
): { path: string; category: string }[] {
  const paths = new Set(
    [...html.matchAll(/href="(\/products\/[^"]+)"/g)].map((m) => m[1] ?? ''),
  );
  const links = [...paths].flatMap((path) => {
    const category = BASEFOOD_CATEGORIES.find(({ slug }) =>
      path.startsWith(`/products/${slug}/`),
    )?.slug;
    return category === undefined ? [] : [{ path, category }];
  });
  if (links.length === 0) throw new Error('商品の一覧が読み取れません');
  return links;
}

/** HTML に埋め込まれた RSC ペイロードの文字列を連結して取り出す。 */
function rscPayload(html: string): string {
  const payload = [
    ...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g),
  ]
    .map((m) => JSON.parse(`"${m[1]}"`) as string)
    .join('');
  if (payload === '') throw new Error('ページの商品情報が読み取れません');
  return payload;
}

/** 商品ページの商品情報（RSC ペイロードの product オブジェクト）のうち読む項目。 */
interface EmbeddedProduct {
  title: string;
  variantTitle: string;
  sku: string;
  normalPrice: number;
  shopUrl: string;
}

function parseEmbeddedProduct(payload: string): EmbeddedProduct {
  const json = matchRequired(
    payload,
    /"product":(\{"name":[\s\S]*?"isSpecialLineProduct":\w+\})/,
    '商品情報',
  );
  const product = JSON.parse(json) as Record<string, unknown>;
  const { title, variantTitle, sku, normalPrice, shopUrl } = product;
  if (
    typeof title !== 'string' ||
    typeof variantTitle !== 'string' ||
    typeof sku !== 'string' ||
    typeof normalPrice !== 'number' ||
    typeof shopUrl !== 'string'
  ) {
    throw new Error('商品情報の形が想定と違います');
  }
  return { title, variantTitle, sku, normalPrice, shopUrl };
}

/**
 * 商品ページの商品名・単品の通常価格（税込）・1 袋または 1 個あたりの栄養成分。
 * 価格は定期購入の割引価格やセット価格でなく normalPrice（単品の通常価格）を使う。
 * 栄養成分は「栄養成分表示」の表から読み、表の注記が「1袋あたり」「1個あたり」の販売単位でなければ例外にする。
 * 読めなければページの形が変わったとみなして例外にする。
 */
export function parseProductPage(html: string): Omit<CatalogItem, 'category'> {
  const payload = rscPayload(html);
  const product = parseEmbeddedProduct(payload);
  const tableStart = payload.indexOf('"title":"栄養成分表示"');
  if (tableStart < 0) throw new Error('栄養成分表示が読み取れません');
  const table = payload.slice(tableStart);
  const value = (label: string, unit: string) =>
    toNumber(
      matchRequired(
        table,
        new RegExp(`"children":"${label}"[^]*?"children":"([\\d.,]+)${unit}"`),
        label,
      ),
    );
  const name = normalizeText(
    `${product.title.replaceAll(/\u00AE|\uFE0E/g, '')} ${product.variantTitle}`,
  );
  matchRequired(
    payload,
    /"children":"(※[^"]*1[袋個]あたり)"/,
    `${name} の単位`,
  );

  return {
    id: product.sku,
    name,
    price: product.normalPrice,
    url: product.shopUrl,
    calories: value('熱量', 'kcal'),
    protein: value('たんぱく質', 'g'),
    fat: value('脂質', 'g'),
    carbs: value('炭水化物', 'g'),
  };
}

export async function scrapeBasefood(): Promise<CatalogItem[]> {
  const links = parseProductLinks(await fetchText(`${BASE_URL}/products`));
  return mapConcurrent(links, FETCH_CONCURRENCY, (link) =>
    fetchText(`${BASE_URL}${link.path}`).then((html) => {
      try {
        return { ...parseProductPage(html), category: link.category };
      } catch (error) {
        throw new Error(`${link.path} の読み取りに失敗`, { cause: error });
      }
    }),
  );
}
