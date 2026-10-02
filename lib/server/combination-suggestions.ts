import 'server-only';

import catalog from '@/data/seven-eleven.json';
import { remainingSlots } from '@/lib/meal-schedule';
import { findMealCombinations } from '@/lib/meal-combinations';
import { getNutritionStatus } from '@/lib/server/meal-context';
import {
  SEVEN_ELEVEN_CATEGORIES,
  itemUrl,
  type SevenElevenItem,
} from '@/lib/seven-eleven';
import type { MealSlot, PFC } from '@/lib/types';
import { formatDate, roundPFC } from '@/lib/utils';

const COMBINATION_COUNT = 5;

const items: readonly SevenElevenItem[] = catalog;

const itemsOf = (role: 'main' | 'side') =>
  items.filter((item) =>
    SEVEN_ELEVEN_CATEGORIES.some(
      (c) => c.slug === item.category && c.role === role,
    ),
  );
const candidates = { mains: itemsOf('main'), sides: itemsOf('side') };

/** 今日の残りを、この食事を含めた今日これからの食事の数で等分した量。 */
function targetFor(remaining: PFC, slot: MealSlot): PFC {
  const meals = remainingSlots(slot).length;
  const share = (value: number) => roundPFC(Math.max(0, value) / meals, 1);
  return {
    protein: share(remaining.protein),
    fat: share(remaining.fat),
    carbs: share(remaining.carbs),
    calories: Math.round(Math.max(0, remaining.calories) / meals),
  };
}

/** セブン-イレブン（関東）の商品から、この食事の目標に近い組み合わせを機械的に選ぶ。AI は使わない。 */
export async function suggestCombinations(userId: string, slot: MealSlot) {
  const status = await getNutritionStatus(userId, formatDate(Date.now()));
  const target = targetFor(status.remaining, slot);
  return {
    store: 'セブン-イレブン',
    slot,
    target,
    combinations: findMealCombinations(
      candidates,
      target,
      COMBINATION_COUNT,
    ).map(({ items: picked, total }) => ({
      items: picked.map((item) => ({ ...item, url: itemUrl(item.id) })),
      total,
      price: picked.reduce((sum, item) => sum + item.price, 0),
    })),
  };
}
