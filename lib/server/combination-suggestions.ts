import 'server-only';

import { CATALOG_STORES, type CatalogStore } from '@/lib/catalog/stores';
import type {
  CombinationItem,
  CombinationSuggestions,
} from '@/lib/catalog/types';
import { remainingSlots } from '@/lib/meal-schedule';
import {
  mealCombinationFinder,
  type MealCandidates,
  type MealCombination,
} from '@/lib/meal-combinations';
import { getNutritionStatus } from '@/lib/server/meal-context';
import type { MealSlot, NearbyStore, PFC } from '@/lib/types';
import { formatDate, roundPFC } from '@/lib/utils';

const COMBINATION_COUNT = 5;

/**
 * 組み合わせを探す範囲。コンビニは自店の商品にメーカーの既製品を足し、
 * スーパーなどカタログの無いお店ではメーカーの既製品だけから組み合わせる。
 */
interface CatalogSource {
  id: string;
  name: string;
  candidates: () => MealCandidates<CombinationItem>;
}

const GROCERY_SOURCE_ID = 'grocery';

function candidatesOf(store: CatalogStore): MealCandidates<CombinationItem> {
  const maker = store.kind === 'メーカー' ? { maker: store.name } : {};
  const itemsOf = (role: 'main' | 'side') =>
    store.items
      .filter((item) =>
        store.categories.some(
          (c) => c.slug === item.category && c.role === role,
        ),
      )
      .map((item) => ({ ...item, ...maker }));
  return { mains: itemsOf('main'), sides: itemsOf('side') };
}

const mergeCandidates = (
  list: MealCandidates<CombinationItem>[],
): MealCandidates<CombinationItem> => ({
  mains: list.flatMap((c) => c.mains),
  sides: list.flatMap((c) => c.sides),
});

const makerCandidates = () =>
  mergeCandidates(
    CATALOG_STORES.filter((store) => store.kind === 'メーカー').map(
      candidatesOf,
    ),
  );

const CATALOG_SOURCES: readonly CatalogSource[] = [
  ...CATALOG_STORES.filter((store) => store.kind !== 'メーカー').map(
    (store) => ({
      id: store.id,
      name: store.name,
      candidates: () =>
        store.kind === 'コンビニ'
          ? mergeCandidates([candidatesOf(store), makerCandidates()])
          : candidatesOf(store),
    }),
  ),
  {
    id: GROCERY_SOURCE_ID,
    name: 'スーパー・ドラッグストア',
    candidates: makerCandidates,
  },
];

/** 画面で選べる組み合わせの範囲。 */
export const CATALOG_SOURCE_OPTIONS = CATALOG_SOURCES.map(({ id, name }) => ({
  id,
  name,
}));

// 副菜の組を作るのに時間がかかるので、範囲ごとに 1 回だけ作って使い回す
const finders = new Map<
  string,
  (target: PFC, count: number) => MealCombination<CombinationItem>[]
>();

function combinationsOf(
  source: CatalogSource,
  target: PFC,
  count: number,
): MealCombination<CombinationItem>[] {
  let find = finders.get(source.id);
  if (!find) {
    find = mealCombinationFinder(source.candidates());
    finders.set(source.id, find);
  }
  return find(target, count);
}

/** 今日の残りを、slot を含めた今日これからの食事の数で等分した量。 */
export function targetFor(remaining: PFC, slot: MealSlot): PFC {
  const meals = remainingSlots(slot).length;
  const share = (value: number) => roundPFC(Math.max(0, value) / meals, 1);
  return {
    protein: share(remaining.protein),
    fat: share(remaining.fat),
    carbs: share(remaining.carbs),
    calories: Math.round(Math.max(0, remaining.calories) / meals),
  };
}

/** 合計の税込価格。価格の分からない商品を含むなら無し。 */
export const totalPrice = (items: CombinationItem[]) =>
  items.every((item) => item.price !== undefined)
    ? items.reduce((sum, item) => sum + (item.price ?? 0), 0)
    : undefined;

/** 範囲の商品から、この食事の目標に近い組み合わせを機械的に選ぶ。AI は使わない。範囲が無ければ undefined。 */
export async function suggestCombinations(
  userId: string,
  sourceId: string,
  slot: MealSlot,
): Promise<CombinationSuggestions | undefined> {
  const source = CATALOG_SOURCES.find((s) => s.id === sourceId);
  if (!source) return undefined;
  const status = await getNutritionStatus(userId, formatDate(Date.now()));
  const target = targetFor(status.remaining, slot);
  return {
    store: source.name,
    slot,
    target,
    combinations: combinationsOf(source, target, COMBINATION_COUNT).map(
      ({ items, total }) => ({ items, total, price: totalPrice(items) }),
    ),
  };
}

/**
 * 近くのお店（またはユーザーが選んだお店）のうち、カタログで組み合わせを探せる範囲。
 * 店名にカタログのお店の名前を含めばそのお店、カタログの無いコンビニ・スーパーならメーカーの既製品。
 */
function sourcesNear(stores: NearbyStore[]): CatalogSource[] {
  const matched = CATALOG_SOURCES.filter((source) =>
    stores.some((store) => store.name.includes(source.name)),
  );
  const hasGrocery = stores.some(
    (store) =>
      /^(コンビニ|スーパー)/.test(store.category) &&
      !matched.some((source) => store.name.includes(source.name)),
  );
  const grocery = CATALOG_SOURCES.find((s) => s.id === GROCERY_SOURCE_ID);
  return hasGrocery && grocery ? [...matched, grocery] : matched;
}

/** AI の提案に渡す、近くのお店ごとの組み合わせ候補。 */
export function combinationsNear(
  stores: NearbyStore[],
  target: PFC,
  count: number,
) {
  return sourcesNear(stores).map((source) => ({
    store: source.name,
    combinations: combinationsOf(source, target, count),
  }));
}
