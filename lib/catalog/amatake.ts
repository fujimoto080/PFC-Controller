import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// アマタケ公式通販サイト（ec.amatake.co.jp）の商品カテゴリページと商品ページから栄養成分を機械的に読み取る。
// 栄養成分と価格はコーポレートサイト（www.amatake.co.jp）の商品ページには無く、通販サイトの商品ページにだけ載っている。
// 商品ページの「商品スペック」の栄養成分・内容量と、埋め込まれた JSON-LD（Product）の税込価格を読む。
// 通販サイトの robots.txt は全体を許可している（コーポレートサイトが案内する lp.amatake.co.jp/secret/ は禁止なので使わない）。

const BASE_URL = 'https://ec.amatake.co.jp/shop';

/** 商品ページを同時に取得する件数。 */
const FETCH_CONCURRENCY = 4;

/**
 * 集める商品カテゴリ（通販サイトの商品カテゴリ ID）。1 パック単位でそのまま食べられる鶏肉・鴨の加工品に絞り、
 * どれも主食に足してたんぱく質を補う副菜とする。
 * 集めない物と理由:
 * - 調理用の生肉（岩手で育てたフランス赤鶏のむね肉・もも肉・ささみ、たのはた鴨のむね肉・もも肉）: 加熱調理が必要で、栄養成分も載っていない
 * - 化粧品（トリコイスト）・鶏コラーゲン粉末・パリ茶漬けなど食事にならない物
 * - 複数個のセット商品・定期便・10 個セット・ファミリーサイズ（320g）: 1 パックの値ではない
 * - 100g あたりしか栄養成分が載っていない物（チキンステーキ、鶏だんご、ロースト鴨など）: 内容量から換算しない
 */
export const AMATAKE_CATEGORIES = [
  { slug: 'salad_chicken', label: 'サラダチキン', role: 'side' },
  { slug: 'protein_deli', label: 'たんぱくデリ', role: 'side' },
  { slug: 'soup', label: 'スープ', role: 'side' },
  { slug: 'duck', label: '鴨', role: 'side' },
] as const satisfies readonly CatalogCategory[];

/** 商品名の先頭に付く販売形態の注記。 */
const NAME_PREFIX = /^[＼\\]公式ショップ限定商品[／/]\s*/;

/**
 * カテゴリページに載っている商品の番号。ページ上部の共通バナーの商品が全カテゴリに載るので、
 * 重複は呼び出し側で最初のカテゴリに寄せる。
 */
export function parseCategoryPage(html: string): string[] {
  const ids = [
    ...new Set(
      [
        ...html.matchAll(
          /href="(?:https:\/\/ec\.amatake\.co\.jp)?\/shop\/products\/([0-9A-Za-z]+)"/g,
        ),
      ].flatMap((m) => m[1] ?? []),
    ),
  ];
  if (ids.length === 0) throw new Error('商品の一覧が読み取れません');
  return ids;
}

/** 文字列の最初の「<数値>g」。 */
const firstGrams = (text: string, label: string) =>
  toNumber(matchRequired(text, /(\d+(?:\.\d+)?)g/, label));

/** 商品スペック（dt と dd の組）の値。 */
function spec(html: string, label: string): string | undefined {
  const value = new RegExp(`<dt>${label}</dt>\\s*<dd>([^<]*)</dd>`).exec(
    html,
  )?.[1];
  return value === undefined ? undefined : normalizeText(value);
}

/**
 * 商品ページの 1 パック分の栄養成分と税込価格。
 * 栄養成分を載せていない商品（生肉・セット商品・化粧品など）、栄養成分が内容量と違う量あたり（100g あたりなど）の商品、
 * 複数個入りのセット（「×10パック」など）は undefined にする。
 * 栄養成分が載っているのに読めなければ、ページの形が変わったとみなして例外にする。
 */
export function parseProductPage(
  html: string,
): Omit<CatalogItem, 'id' | 'category' | 'url'> | undefined {
  const nutrition = spec(html, '栄養成分');
  if (nutrition === undefined) return undefined;
  const amount = matchRequired(spec(html, '内容量') ?? '', /(.+)/, '内容量');
  const sets = /×\s*(\d+)/.exec(amount)?.[1];
  if (sets !== undefined && sets !== '1') return undefined;

  const basis = matchRequired(nutrition, /^\[([^\]]*)\]/, '栄養成分の単位');
  if (firstGrams(basis, '栄養成分の対象') !== firstGrams(amount, '内容量')) {
    return undefined;
  }

  const grams = (label: string) =>
    toNumber(
      matchRequired(nutrition, new RegExp(`${label}:\\s*([\\d.,]+)g`), label),
    );
  const name = normalizeText(
    matchRequired(html, /"@type": "Product",\s*"name": "([^"]*)"/, '商品名'),
  ).replace(NAME_PREFIX, '');
  const price = toNumber(
    matchRequired(html, /"price": "(\d+)"/, `${name} の価格`),
  );
  return {
    name,
    price,
    calories: toNumber(
      matchRequired(nutrition, /エネルギー:\s*([\d.,]+)kcal/, 'エネルギー'),
    ),
    protein: grams('たんぱく質'),
    fat: grams('脂質'),
    carbs: grams('炭水化物'),
  };
}

export async function scrapeAmatake(): Promise<CatalogItem[]> {
  const pages = await mapConcurrent(
    AMATAKE_CATEGORIES,
    FETCH_CONCURRENCY,
    async ({ slug }) =>
      parseCategoryPage(
        await fetchText(`${BASE_URL}/product_categories/${slug}`),
      ),
  );
  // 複数のカテゴリに載る商品は最初のカテゴリに入れる
  const categoryOf = new Map<string, string>();
  AMATAKE_CATEGORIES.forEach(({ slug }, index) => {
    for (const id of pages[index] ?? []) {
      if (!categoryOf.has(id)) categoryOf.set(id, slug);
    }
  });

  const products = [...categoryOf].map(([id, category]) => ({ id, category }));
  const details = await mapConcurrent(products, FETCH_CONCURRENCY, ({ id }) =>
    fetchText(`${BASE_URL}/products/${id}`).then((html) => {
      try {
        return parseProductPage(html);
      } catch (error) {
        throw new Error(`商品 ${id} の読み取りに失敗`, { cause: error });
      }
    }),
  );
  return products.flatMap(({ id, category }, index): CatalogItem[] => {
    const detail = details[index];
    if (detail === undefined) return [];
    return [
      {
        id,
        category,
        url: `${BASE_URL}/products/${id}`,
        ...detail,
      },
    ];
  });
}
