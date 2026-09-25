import type { FoodItemInput } from './types';

/**
 * フォームの生値を安全に数値化する。空欄由来の NaN / undefined / 不正文字列は 0 に丸める。
 * react-hook-form の valueAsNumber 有無（number でも string でも）両方を受けられる。
 */
function safeNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** PFC フォームが共通で持つ入力値。react-hook-form の値型に対する最小の制約。 */
export interface PfcFormValues {
  name: string;
  protein?: number | string;
  fat?: number | string;
  carbs?: number | string;
  calories?: number | string;
  store?: string;
  storeGroup?: string;
}

/** react-hook-form の値を FoodItemInput に整形する。空文字の store/storeGroup は undefined にする。 */
export function toFoodInput(
  values: PfcFormValues,
  timestamp: number,
): FoodItemInput {
  return {
    name: values.name,
    protein: safeNumber(values.protein),
    fat: safeNumber(values.fat),
    carbs: safeNumber(values.carbs),
    calories: safeNumber(values.calories),
    store: values.store === '' ? undefined : values.store,
    storeGroup: values.storeGroup === '' ? undefined : values.storeGroup,
    timestamp,
  };
}
