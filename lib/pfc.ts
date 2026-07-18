import type { FoodItemInput } from './types';

/** 目標に対する摂取割合(%)。0〜100 にクランプする。target<=0 の場合は 0。 */
export function progressPct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

/** 閾値を超えているとき強調（赤・太字）、そうでなければ控えめな色を返す。 */
export function overLimitTextClass(current: number, threshold: number): string {
  return current > threshold ? 'text-red-500 font-bold' : 'text-muted-foreground';
}

/**
 * フォームの生値を安全に数値化する。空欄由来の NaN / undefined / 不正文字列は 0 に丸める。
 * react-hook-form の valueAsNumber 有無（number でも string でも）両方を受けられる。
 */
export function safePfcNumber(value: unknown): number {
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

/**
 * react-hook-form の値を FoodItemInput に整形する共通処理。
 * P/F/C/カロリーは safePfcNumber で NaN ガードし、空文字の store/storeGroup は undefined にする。
 */
export function toFoodInput(values: PfcFormValues, timestamp: number): FoodItemInput {
  return {
    name: values.name,
    protein: safePfcNumber(values.protein),
    fat: safePfcNumber(values.fat),
    carbs: safePfcNumber(values.carbs),
    calories: safePfcNumber(values.calories),
    store: values.store === '' ? undefined : values.store,
    storeGroup: values.storeGroup === '' ? undefined : values.storeGroup,
    timestamp,
  };
}
