import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// プリマハム公式サイトの商品一覧ページ（/products/<カテゴリ>/）と商品ページ（/products/detail/<番号>.html）の
// HTML から栄養成分を機械的に読み取る。一覧で商品番号を取り、栄養成分は商品ページの表から読む。
// robots.txt は無い（404）。商品ページは同時 4 件で取得する。
// 公式サイトには価格（希望小売価格）が載っていないので、価格は付けない。

const BASE_URL = 'https://www.primaham.co.jp/products';

/** 商品ページを同時に取得する件数。 */
const FETCH_CONCURRENCY = 4;

/**
 * 集める商品カテゴリ（商品一覧ページの URL のカテゴリ名）。そのまま食べられるチキン・ハム系の個食に絞る。
 * 集めないカテゴリと理由:
 * - ベーコン・ウインナー・ソーセージ・焼豚・ハンバーグ・肉だんご・チキン（フライドチキンなど）・
 *   冷凍・中華・その他惣菜: 加熱調理が前提だったり、レトルトや鍋の具でそのままは食べなかったりする。
 *   弁当や 1 食の主食になる個食も無い
 * - 商品ごとの栄養成分が 100g 当たりや 1 切れ・1 個当たりの物（大袋のハム・ブロックなど）: 1 パックの値が分からない。
 *   内容量が載っていないので重さから換算はしない
 */
export const PRIMAHAM_CATEGORIES = [
  { slug: 'saladchicken', label: 'サラダチキン', role: 'side' },
  { slug: 'ham', label: 'ハム', role: 'side' },
  { slug: 'prosciutto', label: '生ハム', role: 'side' },
  { slug: 'dry', label: 'サラミ・カルパス', role: 'side' },
] as const satisfies readonly CatalogCategory[];

/**
 * 栄養成分の見出し「栄養成分表示 （1袋100g当たり）」。「1パック」「1袋」「1本」のように
 * 販売単位あたりと明示されている物だけを集める。「34g当たり」「100g当たり」は 1 パックの値かどうか分からない。
 */
const PACK_HEADING =
  /栄養成分表示\s*\(1(?:パック|袋|本)\s*[\d.]+g\s*(?:当たり|あたり)\)/;

/** 商品ページの栄養成分の見出し（h3）。 */
const NUTRITION_HEADING =
  /<h3 class="ttl-cmn-03">\s*(栄養成分表示[^<]*)<\/h3>/g;

/** 商品一覧ページの商品リストの範囲。ヘッダーやフッターのリンクを拾わないよう、この中だけを読む。 */
const LIST_START = '<ul class="list-brand-products">';

/** 商品一覧ページから商品番号を読む。商品が 1 件も読めなければ例外にする。 */
export function parseProductIds(html: string): string[] {
  const start = html.indexOf(LIST_START);
  if (start < 0) throw new Error('商品の一覧が読み取れません');
  const ids = [
    ...new Set(
      [...html.slice(start).matchAll(/\/products\/detail\/(\d+)\.html/g)].map(
        (m) => m[1] ?? '',
      ),
    ),
  ];
  if (ids.length === 0) throw new Error('商品の一覧が読み取れません');
  return ids;
}

/** 商品ページの商品名と、1 パックあたりの栄養成分。 */
interface ProductDetail {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** 栄養成分の表（PC 向け）の見出し → 値。 */
function nutritionTable(html: string): Map<string, string> {
  const table = matchRequired(
    html,
    /<table class="table-nutritional only-pc">([\s\S]*?)<\/table>/,
    '栄養成分の表',
  );
  const cells = (tag: 'th' | 'td') =>
    [...table.matchAll(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'g'))].map((m) =>
      normalizeText(m[1] ?? ''),
    );
  const labels = cells('th');
  const values = cells('td');
  if (labels.length === 0 || labels.length !== values.length) {
    throw new Error('栄養成分の表が読み取れません');
  }
  return new Map(labels.map((label, i) => [label, values[i] ?? '']));
}

/**
 * 商品ページの商品名と 1 パックあたりの栄養成分。栄養成分を載せていない商品と、
 * 見出しが販売単位あたり（1 パック・1 袋・1 本）でない商品は undefined にする。
 * 見出しが販売単位あたりなのに表が読めなければ、ページの形が変わったとみなして例外にする。
 */
export function parseProductPage(html: string): ProductDetail | undefined {
  const headings = [...html.matchAll(NUTRITION_HEADING)].map((m) =>
    normalizeText(m[1] ?? ''),
  );
  if (headings.length !== 1 || !PACK_HEADING.test(headings[0] ?? '')) {
    return undefined;
  }

  const nutrition = nutritionTable(html);
  const value = (label: string, unit: string) => {
    const text = nutrition.get(label);
    return toNumber(
      matchRequired(
        text ?? '',
        new RegExp(`^([\\d.,]+)${unit}$`),
        `栄養成分の${label}`,
      ),
    );
  };

  const title = matchRequired(
    html,
    /<h2 class="ttl-cmn-02[^"]*">\s*<div class="txt-title">([\s\S]*?)<\/div>/,
    '商品名',
  );
  return {
    name: normalizeText(
      title.replace(/<br\s*\/?>/g, ' ').replaceAll('&reg;', '®'),
    ),
    calories: value('エネルギー', 'kcal'),
    protein: value('たんぱく質', 'g'),
    fat: value('脂質', 'g'),
    carbs: value('炭水化物', 'g'),
  };
}

export async function scrapePrimaham(): Promise<CatalogItem[]> {
  // 同じ商品が複数のカテゴリに載っていたら最初のカテゴリに入れる
  const products = new Map<string, { id: string; category: string }>();
  for (const { slug } of PRIMAHAM_CATEGORIES) {
    for (const id of parseProductIds(await fetchText(`${BASE_URL}/${slug}/`))) {
      if (!products.has(id)) products.set(id, { id, category: slug });
    }
  }

  const listed = [...products.values()];
  const details = await mapConcurrent(listed, FETCH_CONCURRENCY, ({ id }) =>
    fetchText(`${BASE_URL}/detail/${id}.html`).then((html) => {
      try {
        return parseProductPage(html);
      } catch (error) {
        throw new Error(`商品 ${id} の読み取りに失敗`, { cause: error });
      }
    }),
  );
  return listed.flatMap(({ id, category }, index): CatalogItem[] => {
    const detail = details[index];
    if (detail === undefined) return [];
    return [
      {
        id,
        category,
        url: `${BASE_URL}/detail/${id}.html`,
        ...detail,
      },
    ];
  });
}
