import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// 日本マクドナルド公式サイトから栄養成分を機械的に読み取る。
// 栄養情報一覧ページ（全商品の kcal・たんぱく質・脂質・炭水化物）と、メニューページ（今販売している商品の一覧）を商品名で突き合わせ、
// 税込価格は各商品ページから読む。

const BASE_URL = 'https://www.mcdonalds.co.jp';
const NUTRITION_URL = `${BASE_URL}/quality/allergy_Nutrition/nutrient/`;

/**
 * 集める商品カテゴリ（slug は公式サイトのメニューページ /menu/<slug>/ の URL）。
 * ドリンク・マックカフェ・スイーツは飲み物や菓子で1食の主食にも副菜にもならず、ハッピーセットは子ども向けの量なので集めない。
 * 「セット」商品は主食と副菜の組み合わせ済みで提案側が組むので、栄養成分一覧にも載っておらず対象外になる。
 */
export const MCDONALDS_CATEGORIES = [
  { slug: 'burger', label: 'バーガー', role: 'main' },
  { slug: 'side', label: 'サイドメニュー', role: 'side' },
] as const satisfies readonly CatalogCategory[];

/**
 * サイドメニューに載っていても食事の副菜にならない物の名前。
 * ソースはナゲットに付けるつけだれ、パイは季節のデザート。
 */
const NOT_SIDE_NAME = /ソース|パイ/;

/** サイズ違いの商品名の末尾。商品ページの価格の見出しは「Sサイズ」のように対応する。 */
const SIZE_SUFFIX = /\((S|M|L)\)$/;

type Size = 'S' | 'M' | 'L';

/** 栄養情報一覧の1行。 */
export interface NutritionRow {
  id: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** 異体字セレクタなど、表記ゆれになる見えない文字を除いて揃えた商品名。 */
const normalizeName = (text: string) => normalizeText(text).replace(/[︀-️]/g, '');

const stripTags = (html: string) => html.replace(/<[^>]*>/g, '');

/** 栄養成分の数値。数値でなければページの形が変わったとみなして例外にする。 */
function requireNumber(text: string | undefined, label: string): number {
  if (text === undefined || !/^\d+(\.\d+)?$/.test(text)) {
    throw new Error(`${label}が読み取れません`);
  }
  return toNumber(text);
}

/**
 * 栄養情報一覧ページの商品ごとの栄養成分（1食当たり）。
 * エネルギーが空の行は栄養成分を載せていないので除く。載っているのに読めなければ例外にする。
 */
export function parseNutritionPage(html: string): NutritionRow[] {
  const table = matchRequired(
    html,
    /<table[^>]*allergy-info__table--second[^>]*>([\s\S]*?)<\/table>/,
    '栄養情報の表',
  );
  const rows = [
    ...table.matchAll(/<tr data-kind='[^']*'[^>]*>([\s\S]*?)<\/tr>/g),
  ].map((row) => row[1] ?? '');
  if (rows.length === 0) throw new Error('栄養情報の行が読み取れません');
  return rows.flatMap((row): NutritionRow[] => {
    const link = /<a href='\/products\/(\d+)\/'[^>]*>([\s\S]*?)<\/a>/.exec(row);
    if (!link) throw new Error('商品ページへのリンクが読み取れません');
    const name = normalizeName(stripTags(link[2] ?? ''));
    // 商品名・エネルギー・たんぱく質・脂質・飽和脂肪酸・炭水化物・…の順
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) =>
      stripTags(cell[1] ?? '').trim(),
    );
    if (cells[1] === '') return [];
    return [
      {
        id: link[1] ?? '',
        name,
        calories: requireNumber(cells[1], `${name} の熱量`),
        protein: requireNumber(cells[2], `${name} のたんぱく質`),
        fat: requireNumber(cells[3], `${name} の脂質`),
        carbs: requireNumber(cells[5], `${name} の炭水化物`),
      },
    ];
  });
}

/** メニューページに載っている商品名（セット商品を含む）。1つも読めなければ例外にする。 */
export function parseMenuListPage(html: string): string[] {
  const names = [...html.matchAll(/product-list-card-name[^>]*>([^<]*)</g)].map(
    (m) => normalizeName(m[1] ?? ''),
  );
  if (names.length === 0) throw new Error('メニューの商品が読み取れません');
  return names;
}

/**
 * 商品ページの税込価格。size があればその大きさ、無ければ「単品」の価格。
 * 店舗で異なる価格は基本価格に「~」が付くので、数字だけを読む。載っていなければ undefined。
 */
export function parsePrice(
  html: string,
  size: Size | undefined,
): number | undefined {
  const label = size === undefined ? '単品' : `${size}サイズ`;
  for (const m of html.matchAll(
    /pdp__product-info-quantity'>([^<]*)<[\s\S]*?product-section-price-primary-val'>([^<]*)</g,
  )) {
    if (m[1]?.trim() === label) {
      const digits = /^\d[\d,]*/.exec((m[2] ?? '').trim())?.[0];
      return digits === undefined ? undefined : toNumber(digits);
    }
  }
  return undefined;
}

interface MenuItem extends NutritionRow {
  category: string;
  size: Size | undefined;
}

/** 栄養情報一覧の商品のうち、メニューページに載っている物をカテゴリ付きで返す。 */
export function selectMenuItems(
  rows: readonly NutritionRow[],
  menuNames: Record<
    (typeof MCDONALDS_CATEGORIES)[number]['slug'],
    readonly string[]
  >,
): MenuItem[] {
  return rows.flatMap((row): MenuItem[] => {
    const baseName = row.name.replace(SIZE_SUFFIX, '');
    const category = MCDONALDS_CATEGORIES.find(
      ({ slug, role }) =>
        menuNames[slug].includes(baseName) &&
        (role === 'main' || !NOT_SIDE_NAME.test(baseName)),
    )?.slug;
    if (category === undefined) return [];
    return [
      {
        ...row,
        category,
        size: SIZE_SUFFIX.exec(row.name)?.[1] as Size | undefined,
      },
    ];
  });
}

export async function scrapeMcdonalds(): Promise<CatalogItem[]> {
  const [nutritionHtml, burger, side] = await Promise.all([
    fetchText(NUTRITION_URL),
    fetchText(`${BASE_URL}/menu/burger/`),
    fetchText(`${BASE_URL}/menu/side/`),
  ]);
  const selected = selectMenuItems(parseNutritionPage(nutritionHtml), {
    burger: parseMenuListPage(burger),
    side: parseMenuListPage(side),
  });
  return mapConcurrent(selected, 4, async (row): Promise<CatalogItem> => {
    const url = `${BASE_URL}/products/${row.id}/`;
    const price = parsePrice(await fetchText(url), row.size);
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      ...(price !== undefined && { price }),
      url,
      calories: row.calories,
      protein: row.protein,
      fat: row.fat,
      carbs: row.carbs,
    };
  });
}
