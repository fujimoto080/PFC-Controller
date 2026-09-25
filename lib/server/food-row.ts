import 'server-only';

import type { FoodItem, FoodItemInput } from '@/lib/types';

/** pfc_log_items / pfc_foods 共通の食品カラム。順序は foodValues と一致させる。 */
export const FOOD_COLUMNS =
  'name, protein, fat, carbs, calories, timestamp_ms, store, store_group, image';

export interface FoodRow {
  id: string;
  name: string;
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
  timestamp_ms: string | number;
  store: string | null;
  store_group: string | null;
  image?: string | null;
}

export function toFoodItem(row: FoodRow): FoodItem {
  return {
    id: row.id,
    name: row.name,
    protein: row.protein,
    fat: row.fat,
    carbs: row.carbs,
    calories: row.calories,
    timestamp: Number(row.timestamp_ms),
    store: row.store ?? undefined,
    storeGroup: row.store_group ?? undefined,
    image: row.image ?? undefined,
  };
}

/** FOOD_COLUMNS の順に並べたクエリパラメータ。 */
export function foodValues(input: FoodItemInput) {
  return [
    input.name,
    input.protein,
    input.fat,
    input.carbs,
    input.calories,
    input.timestamp,
    input.store ?? null,
    input.storeGroup ?? null,
    input.image ?? null,
  ];
}
