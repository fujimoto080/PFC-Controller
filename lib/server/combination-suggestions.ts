import 'server-only';

import type { CatalogStore } from '@/lib/catalog/stores';
import { remainingSlots } from '@/lib/meal-schedule';
import { findMealCombinations } from '@/lib/meal-combinations';
import { getNutritionStatus } from '@/lib/server/meal-context';
import type { MealSlot, PFC } from '@/lib/types';
import { formatDate, roundPFC } from '@/lib/utils';

const COMBINATION_COUNT = 5;

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

/** お店の商品から、この食事の目標に近い組み合わせを機械的に選ぶ。AI は使わない。 */
export async function suggestCombinations(
  userId: string,
  store: CatalogStore,
  slot: MealSlot,
) {
  const status = await getNutritionStatus(userId, formatDate(Date.now()));
  const target = targetFor(status.remaining, slot);
  const itemsOf = (role: 'main' | 'side') =>
    store.items.filter((item) =>
      store.categories.some((c) => c.slug === item.category && c.role === role),
    );
  const combinations = findMealCombinations(
    { mains: itemsOf('main'), sides: itemsOf('side') },
    target,
    COMBINATION_COUNT,
  );
  return {
    store: store.name,
    slot,
    target,
    combinations: combinations.map(({ items, total }) => ({
      items,
      total,
      /** 合計の税込価格。価格の分からない商品を含むなら無し */
      price: items.every((item) => item.price !== undefined)
        ? items.reduce((sum, item) => sum + (item.price ?? 0), 0)
        : undefined,
    })),
  };
}
