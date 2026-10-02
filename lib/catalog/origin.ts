import { fetchText, normalizeText } from './scrape.ts';
import type { CatalogCategory, CatalogItem } from './types';

// キッチンオリジン（オリジン弁当）公式サイトのメニューページから栄養成分を機械的に読み取る。
// メニューページの HTML に埋め込まれた Next.js の RSC ペイロードに、全商品の価格・栄養成分の構造化データがある。

const BASE_URL = 'https://kitchen-origin.toshu.co.jp';

/**
 * 集める商品カテゴリ（公式サイトのカテゴリの key）。店で買ってそのまま食べられる食事になる物に絞る。
 * スイーツとお飲み物は食事にならないため、冷凍弁当（/?category=frozen）は価格が載っておらず冷凍で持ち帰る商品のため含めない。
 */
export const ORIGIN_CATEGORIES = [
  { slug: 'freshly_made_bento', label: 'お弁当・丼・ライス', role: 'main' },
  { slug: 'in_store_rice_balls', label: 'おにぎり', role: 'main' },
  { slug: 'bento_side_dishes', label: 'お弁当のおかず', role: 'side' },
  { slug: 'single_dishes_and_fried', label: '一品・揚げ物', role: 'side' },
  { slug: 'prepared_foods', label: '惣菜', role: 'side' },
  { slug: 'salads', label: 'サラダ', role: 'side' },
] as const satisfies readonly CatalogCategory[];

/** 1 個・1 パックなど販売単位あたりで栄養成分が載っている販売単位（公式サイトの common.unit.*）。 */
const PER_UNIT_SALES_UNITS = new Set([
  'piece',
  'pack',
  'bottle',
  'sheet',
  'slice',
  'tail',
  'bowl',
  'cup',
  'meal',
]);

/** 量り売り（100g あたりの価格・栄養成分）の販売単位。 */
const PER_100G_SALES_UNIT = 'g100';

/** 店頭では買えない予約専用の商品の名前の頭。 */
const RESERVATION_ONLY_PREFIX = '【ご予約専用】';

/** RSC ペイロード中の商品。使う項目だけ。 */
interface Menu {
  uniqueId: string;
  productCode: string;
  region: string;
  salesUnit: string;
  priceWithTax: number | null;
  energy: number | null;
  protein: number | null;
  fat: number | null;
  carbohydrates: number | null;
  translations: { lang: string; productName: string; productNameSub: string }[];
}

interface MenuCategory {
  key: string;
  menus: Menu[];
}

/** HTML に埋め込まれた RSC ペイロード（self.__next_f.push([1, "..."]) の文字列を繋げたもの）。 */
function rscPayload(html: string): string {
  return [
    ...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g),
  ]
    .map((m) => JSON.parse(m[1] ?? '') as string)
    .join('');
}

/** value の中から menusByCategory を持つオブジェクトを探し、その値を返す。 */
function findMenusByCategory(value: unknown): MenuCategory[] | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  if ('menusByCategory' in value) {
    return value.menusByCategory as MenuCategory[];
  }
  for (const child of Object.values(value)) {
    const found = findMenusByCategory(child);
    if (found) return found;
  }
  return undefined;
}

/** 栄養成分の数値。数値でなければページの形が変わったとみなして例外にする。 */
function requireNumber(value: unknown, label: string): number {
  if (typeof value !== 'number') throw new Error(`${label}が読み取れません`);
  return value;
}

/**
 * メニューページの商品のうち、ORIGIN_CATEGORIES に入る関東の商品。
 * 栄養成分を載せていない商品・予約専用の商品・栄養成分の単位が分からない商品は除く。
 * 栄養成分が載っているのに読めなければ、ページの形が変わったとみなして例外にする。
 */
export function parseMenuPage(html: string): CatalogItem[] {
  // RSC ペイロードは「行 ID:JSON」の行の並び
  const row = rscPayload(html)
    .split('\n')
    .find((line) => line.includes('"menusByCategory"'));
  if (row === undefined) throw new Error('メニューの一覧が読み取れません');
  const categories = findMenusByCategory(
    JSON.parse(row.replace(/^[0-9a-f]+:/, '')),
  );
  if (categories === undefined) {
    throw new Error('メニューの一覧が読み取れません');
  }

  return ORIGIN_CATEGORIES.flatMap(({ slug }) => {
    const menus = categories.find((c) => c.key === slug)?.menus ?? [];
    return menus.flatMap((menu): CatalogItem[] => {
      const ja = menu.translations.find((t) => t.lang === 'ja');
      if (ja === undefined) throw new Error('商品名が読み取れません');
      const name = normalizeText(`${ja.productName} ${ja.productNameSub}`);
      if (
        menu.region !== 'east' ||
        menu.energy === null ||
        ja.productName.startsWith(RESERVATION_ONLY_PREFIX)
      ) {
        return [];
      }
      const per100g = menu.salesUnit === PER_100G_SALES_UNIT;
      if (!per100g && !PER_UNIT_SALES_UNITS.has(menu.salesUnit)) return [];
      return [
        {
          id: menu.productCode,
          name: per100g ? `${name}(100gあたり)` : name,
          category: slug,
          ...(menu.priceWithTax !== null && {
            price: Math.round(menu.priceWithTax),
          }),
          url: `${BASE_URL}/detail${menu.uniqueId}`,
          calories: requireNumber(menu.energy, `${name} の熱量`),
          protein: requireNumber(menu.protein, `${name} のたんぱく質`),
          fat: requireNumber(menu.fat, `${name} の脂質`),
          carbs: requireNumber(menu.carbohydrates, `${name} の炭水化物`),
        },
      ];
    });
  });
}

export async function scrapeOrigin(): Promise<CatalogItem[]> {
  return parseMenuPage(await fetchText(`${BASE_URL}/`));
}
