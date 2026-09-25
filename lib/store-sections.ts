import type { FoodItem, Logs } from './types';

export interface StoreGroupSection {
  storeName: string;
  groups: {
    groupName: string;
    foods: FoodItem[];
  }[];
}

/** 食品リストを 店舗 → 店内グループ の 2 階層セクションに畳み込む。出現順を保つ。 */
export function buildStoreSections(foods: FoodItem[]): StoreGroupSection[] {
  const byStore = new Map<string, Map<string, FoodItem[]>>();
  for (const food of foods) {
    const storeName = food.store ?? 'その他';
    const groupName = food.storeGroup ?? '未分類';
    const groups = byStore.get(storeName) ?? new Map<string, FoodItem[]>();
    byStore.set(storeName, groups);
    groups.set(groupName, [...(groups.get(groupName) ?? []), food]);
  }
  return Array.from(byStore, ([storeName, groups]) => ({
    storeName,
    groups: Array.from(groups, ([groupName, foods]) => ({ groupName, foods })),
  }));
}

function uniqueSorted(values: (string | undefined)[]): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => !!value)),
  ).sort();
}

/** 食品辞書と食事記録に登場する店名を重複なしで昇順に返す。 */
export function collectStores(foods: FoodItem[], logs: Logs): string[] {
  return uniqueSorted(
    [...foods, ...Object.values(logs).flatMap((log) => log.items)].map(
      (food) => food.store,
    ),
  );
}

/** 食品辞書に登場する店内グループ名を重複なしで昇順に返す。 */
export function collectStoreGroups(foods: FoodItem[]): string[] {
  return uniqueSorted(foods.map((food) => food.storeGroup));
}
