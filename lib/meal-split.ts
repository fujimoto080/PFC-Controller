import { MEAL_SLOTS, remainingSlots } from './meal-schedule';
import type { MealSlot, MealSplit } from './types';

/** 朝 30%・昼 35%・夜 35%。 */
export const DEFAULT_MEAL_SPLIT: MealSplit = { breakfastEnd: 30, lunchEnd: 65 };

/** 食事枠ごとの配分（%）。 */
function slotShares(split: MealSplit): Record<MealSlot, number> {
  return {
    breakfast: split.breakfastEnd,
    lunch: split.lunchEnd - split.breakfastEnd,
    dinner: 100 - split.lunchEnd,
  };
}

/**
 * slot を含めた今日これからの食事のうち、slot に割り当てる割合（0〜1）。
 * 配分の合計が 0（残りの食事がどれも 0%）なら等分にする。
 */
export function slotFraction(split: MealSplit, slot: MealSlot): number {
  const shares = slotShares(split);
  const left = remainingSlots(slot);
  const total = left.reduce((sum, s) => sum + shares[s], 0);
  return total > 0 ? shares[slot] / total : 1 / left.length;
}

/** 食事枠の並びと配分（%）。画面に出す用。 */
export function splitSegments(split: MealSplit) {
  const shares = slotShares(split);
  return MEAL_SLOTS.map((meta) => ({ ...meta, share: shares[meta.slot] }));
}
