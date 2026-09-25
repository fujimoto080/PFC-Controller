import type { BarcodeFood } from './barcode';
import type { FoodItem, FoodItemInput } from './types';

/**
 * PFC フォームが共通で持つ入力値。
 * number input は valueAsNumber の有無で number / string のどちらにもなり得る。
 */
export interface PfcFormValues {
  name: string;
  protein?: number | string;
  fat?: number | string;
  carbs?: number | string;
  calories?: number | string;
  store?: string;
  storeGroup?: string;
}

export const EMPTY_FORM_VALUES: PfcFormValues = {
  name: '',
  protein: '',
  fat: '',
  carbs: '',
  calories: '',
  store: '',
  storeGroup: '',
};

/** 空欄由来の NaN / 空文字 / 不正文字列は 0 に丸める。 */
function safeNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

const emptyToUndefined = (value?: string) => (value === '' ? undefined : value);

/** 記録の元になる食品（食品リスト・過去の記録・バーコードマッピング）の共通部分。 */
export type FoodTemplate = BarcodeFood & Pick<FoodItem, 'storeGroup'>;

/** 既存の食品をフォームの初期値に変換する。 */
export function toFormValues(food: FoodTemplate): PfcFormValues {
  return {
    name: food.name,
    protein: food.protein,
    fat: food.fat,
    carbs: food.carbs,
    calories: food.calories,
    store: food.store ?? '',
    storeGroup: food.storeGroup ?? '',
  };
}

/** フォームの値を FoodItemInput に整形する。空文字の store/storeGroup は undefined にする。 */
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
    store: emptyToUndefined(values.store),
    storeGroup: emptyToUndefined(values.storeGroup),
    timestamp,
  };
}

/** 既存の食品を指定時刻の記録として追加するための入力に変換する。 */
export function toLogInput(
  { name, protein, fat, carbs, calories, store, storeGroup }: FoodTemplate,
  timestamp: number,
): FoodItemInput {
  return { name, protein, fat, carbs, calories, store, storeGroup, timestamp };
}
