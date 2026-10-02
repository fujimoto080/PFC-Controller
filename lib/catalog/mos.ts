import {
  fetchText,
  mapConcurrent,
  matchRequired,
  normalizeText,
  toNumber,
} from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// モスバーガー公式サイトのメニューページが読み込む JSON（/data/menu/menu_category/<カテゴリ ID>.json）から
// 商品名・税込価格・栄養成分を機械的に読み取る。栄養成分情報ページ（/menu/nutrition/）も同じ JSON を使っている。
// JSON はカテゴリごとの商品の配列で、サイズ違いのある商品は group にサイズごとの価格・栄養成分を持つ。

const BASE_URL = 'https://www.mos.jp';

/**
 * 集める商品カテゴリ（公式サイトのカテゴリ ID を slug にする）。複数のカテゴリに載る商品は最初のカテゴリに入れる。
 * 限定メニュー（26）はドリンク・デザートも混ざり、バーガーは通常のカテゴリにも載るので集めない。
 * ドリンク／スープ（34）とデザート（9）は 1 食の主食や副菜にならず、
 * モスワイワイセット（11）はお子さま向けの小さなセットなので集めない。
 */
export const MOS_CATEGORIES = [
  { slug: '27', label: 'とびきりバーガー', role: 'main' },
  { slug: '1', label: 'ハンバーガー', role: 'main' },
  { slug: '35', label: 'ライスバーガー・ホットドッグ', role: 'main' },
  { slug: '30', label: 'モスの菜摘', role: 'main' },
  { slug: '33', label: 'ソイパティ', role: 'main' },
  { slug: '32', label: '低アレルゲンメニュー', role: 'main' },
  { slug: '12', label: '朝モス', role: 'main' },
  { slug: '7', label: 'サイドメニュー', role: 'side' },
] as const satisfies readonly CatalogCategory[];

/**
 * 単品で食べない別添のソース・ドレッシング・ジャムと、複数人向けのパック・冷凍品の名前。集めない。
 */
const EXCLUDED_NAME =
  /^(?:チリディップソース|カップ|バーベキューソース|マスタードソース|和風ドレッシング|ストロベリージャム|冷凍)|パック/;

/** サイズ違いの商品の size（公式サイトの数字）に対応するサイズ名。 */
const SIZE_NAMES: Record<number, string> = {
  1: 'S',
  2: 'M',
  3: 'L',
  4: 'プチ',
};

interface NutritionRow {
  name: string;
  quantity: string;
}

/** 1 つの販売単位（単品、またはサイズ違いの 1 サイズ）。 */
interface Priced {
  price: number | null;
  nutrition?: NutritionRow[];
}

/** JSON の商品。使う項目だけ。 */
interface Menu extends Priced {
  id: string;
  name: string;
  group?: Record<string, Priced & { menu_id: string; size: number }>;
}

/** 栄養成分の表から label の数値（単位の前まで）を読む。 */
function readNutrition(
  rows: NutritionRow[],
  itemName: string,
  label: string,
): number {
  const row = rows.find((r) => r.name === label);
  return toNumber(
    matchRequired(row?.quantity ?? '', /^([\d.,]+)/, `${itemName} の${label}`),
  );
}

/**
 * カテゴリの JSON（商品の配列）から、栄養成分を載せている商品を集める。
 * 栄養成分の表が無い商品は除く。表があるのに読めなければ、ページの形が変わったとみなして例外にする。
 * サイズ違いは別商品にする。
 */
export function parseCategoryMenus(
  json: string,
  category: string,
): CatalogItem[] {
  const menus = JSON.parse(json) as Menu[];
  if (!Array.isArray(menus)) throw new Error('メニューの一覧が読み取れません');

  return menus.flatMap((menu) => {
    const baseName = normalizeText(menu.name);
    if (EXCLUDED_NAME.test(baseName)) return [];
    const units: { id: string; name: string; unit: Priced }[] = menu.group
      ? Object.values(menu.group).map((variant) => ({
          id: variant.menu_id,
          name: `${baseName} ${SIZE_NAMES[variant.size] ?? ''}`.trim(),
          unit: variant,
        }))
      : [{ id: menu.id, name: baseName, unit: menu }];

    return units.flatMap(({ id, name, unit }): CatalogItem[] => {
      if (unit.nutrition === undefined) return [];
      return [
        {
          id,
          name,
          category,
          ...(unit.price !== null && { price: Math.round(unit.price) }),
          url: `${BASE_URL}/menu/detail/?menu_id=${menu.id}&c_id=${category}`,
          calories: readNutrition(unit.nutrition, name, 'エネルギー'),
          protein: readNutrition(unit.nutrition, name, 'たんぱく質'),
          fat: readNutrition(unit.nutrition, name, '脂質'),
          carbs: readNutrition(unit.nutrition, name, '炭水化物'),
        },
      ];
    });
  });
}

export async function scrapeMos(): Promise<CatalogItem[]> {
  const jsons = await mapConcurrent(MOS_CATEGORIES, 4, ({ slug }) =>
    fetchText(`${BASE_URL}/data/menu/menu_category/${slug}.json`),
  );
  const items = new Map<string, CatalogItem>();
  MOS_CATEGORIES.forEach(({ slug }, index) => {
    for (const item of parseCategoryMenus(jsons[index] ?? '', slug)) {
      if (!items.has(item.id)) items.set(item.id, item);
    }
  });
  return [...items.values()];
}
