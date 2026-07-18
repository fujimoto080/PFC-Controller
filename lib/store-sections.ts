import type { FoodItem } from './types';

export const STORAGE_KEY_MANAGE_FOODS_COLLAPSE = 'pfc_manage_foods_collapse_state';

export interface CollapseState {
  collapsedStores: string[];
  collapsedGroups: string[];
}

/** manage-foods ページの折りたたみ状態を localStorage から読む。壊れていれば空で返す。 */
export function readCollapseState(): CollapseState {
  if (typeof window === 'undefined') return { collapsedStores: [], collapsedGroups: [] };

  const stored = localStorage.getItem(STORAGE_KEY_MANAGE_FOODS_COLLAPSE);
  if (!stored) return { collapsedStores: [], collapsedGroups: [] };

  try {
    const parsed = JSON.parse(stored) as {
      collapsedStores?: string[];
      collapsedGroups?: string[];
    };
    return {
      collapsedStores: Array.isArray(parsed.collapsedStores) ? parsed.collapsedStores : [],
      collapsedGroups: Array.isArray(parsed.collapsedGroups) ? parsed.collapsedGroups : [],
    };
  } catch {
    return { collapsedStores: [], collapsedGroups: [] };
  }
}

export interface StoreGroupSection {
  storeName: string;
  groups: {
    groupName: string;
    foods: FoodItem[];
  }[];
}

export const getStoreName = (food: FoodItem) => food.store ?? 'その他';
export const getStoreGroupName = (food: FoodItem) => food.storeGroup ?? '未分類';

/** 食品リストを 店舗 → 店内グループ の 2 階層セクションに畳み込む純関数。 */
export function buildStoreSections(foods: FoodItem[]): StoreGroupSection[] {
  const sections: StoreGroupSection[] = [];

  foods.forEach((food) => {
    const storeName = getStoreName(food);
    const groupName = getStoreGroupName(food);

    let storeSection = sections.find((section) => section.storeName === storeName);
    if (!storeSection) {
      storeSection = { storeName, groups: [] };
      sections.push(storeSection);
    }

    let groupSection = storeSection.groups.find((group) => group.groupName === groupName);
    if (!groupSection) {
      groupSection = { groupName, foods: [] };
      storeSection.groups.push(groupSection);
    }

    groupSection.foods.push(food);
  });

  return sections;
}
