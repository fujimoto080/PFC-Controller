import { MEAL_SLOTS, upcomingSlots } from './meal-schedule';
import { sumPFC } from './pfc';
import type { MealSlot, MealSplit, PFC } from './types';

/** 朝は軽め、昼と夜は同じ量（朝 20%・昼 40%・夜 40%）。 */
export const DEFAULT_MEAL_SPLIT: MealSplit = { breakfastEnd: 20, lunchEnd: 60 };

/** 食事枠ごとの配分（%）。 */
function slotShares(split: MealSplit): Record<MealSlot, number> {
  return {
    breakfast: split.breakfastEnd,
    lunch: split.lunchEnd - split.breakfastEnd,
    dinner: 100 - split.lunchEnd,
  };
}

/**
 * 今日の残りのうち slot で食べる量の目安。slot と今日これから食べる食事枠（upcomingSlots）で、残りを配分の比率で分ける。
 * slot に割り当てた食べた物があれば、その分も含めて分けたうえで差し引き、食べ足す分だけを返す。
 * 配分の合計が 0（どれも 0%）なら等分にする。
 */
export function targetFor(
  remaining: PFC,
  slot: MealSlot,
  split: MealSplit,
  eaten: readonly (PFC & { slot: MealSlot })[],
  now: number,
): PFC {
  const shares = slotShares(split);
  const slots = new Set([slot, ...upcomingSlots(eaten, now)]);
  const total = [...slots].reduce((sum, s) => sum + shares[s], 0);
  const fraction = total > 0 ? shares[slot] / total : 1 / slots.size;
  const done = sumPFC(eaten.filter((item) => item.slot === slot));
  const share = (key: keyof PFC) =>
    Math.max(
      0,
      (Math.max(0, remaining[key]) + done[key]) * fraction - done[key],
    );
  const calories = Math.round(share('calories'));
  // 残りカロリー内でPを優先し、F/Cの不足を埋めるための追加食を求めない。
  const protein =
    Math.floor(Math.min(share('protein'), calories / 4) * 10) / 10;
  const fat =
    Math.floor(
      Math.min(share('fat'), Math.max(0, calories - protein * 4) / 9) * 10,
    ) / 10;
  const carbs =
    Math.floor(
      Math.min(
        share('carbs'),
        Math.max(0, calories - protein * 4 - fat * 9) / 4,
      ) * 10,
    ) / 10;
  return { protein, fat, carbs, calories };
}

/** 食事枠の並びと配分（%）。画面に出す用。 */
export function splitSegments(split: MealSplit) {
  const shares = slotShares(split);
  return MEAL_SLOTS.map((meta) => ({ ...meta, share: shares[meta.slot] }));
}

/** 既定の配分と同じか。 */
export function isDefaultSplit(split: MealSplit): boolean {
  return (
    split.breakfastEnd === DEFAULT_MEAL_SPLIT.breakfastEnd &&
    split.lunchEnd === DEFAULT_MEAL_SPLIT.lunchEnd
  );
}
