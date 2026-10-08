import { DEFAULT_MEAL_SPLIT, targetFor } from '@/lib/meal-split';
import type { MealSlot } from '@/lib/types';
import { toJstTimestamp } from '@/lib/utils';

const at = (time: string) => toJstTimestamp('2026-09-28', time);
const meal = (slot: MealSlot, calories: number) => ({
  slot,
  protein: 0,
  fat: 0,
  carbs: 0,
  calories,
});

describe('targetFor', () => {
  it('カロリーに達したらPFCが不足していても追加食を割り当てない', () => {
    expect(
      targetFor(
        { protein: 40, fat: 20, carbs: 60, calories: -42 },
        'dinner',
        DEFAULT_MEAL_SPLIT,
        [],
        at('19:00'),
      ),
    ).toEqual({ protein: 0, fat: 0, carbs: 0, calories: 0 });
  });
  it('PFCのエネルギーが残りカロリーを超えない', () => {
    const target = targetFor(
      { protein: 40, fat: 20, carbs: 60, calories: 200 },
      'dinner',
      DEFAULT_MEAL_SPLIT,
      [],
      at('19:00'),
    );
    expect(
      target.protein * 4 + target.fat * 9 + target.carbs * 4,
    ).toBeLessThanOrEqual(target.calories);
    expect(target.protein).toBe(40);
  });
  const remaining = { protein: 90, fat: 30, carbs: 300, calories: 1800 };

  it('朝から考えるときは残りを配分の比率で割り当てる', () => {
    const split = { breakfastEnd: 25, lunchEnd: 50 };
    expect(targetFor(remaining, 'breakfast', split, [], at('07:00'))).toEqual({
      protein: 22.5,
      fat: 7.5,
      carbs: 73.1,
      calories: 450,
    });
  });

  it('朝を食べたら、残りを昼と夜で分ける', () => {
    const eaten = [meal('breakfast', 300)];
    expect(
      targetFor(remaining, 'lunch', DEFAULT_MEAL_SPLIT, eaten, at('08:00'))
        .calories,
    ).toBe(900);
  });

  it('昼を食べたら、昼の時間帯でも夜に残りすべてを割り当てる', () => {
    const eaten = [meal('lunch', 600)];
    expect(
      targetFor(remaining, 'dinner', DEFAULT_MEAL_SPLIT, eaten, at('13:00'))
        .calories,
    ).toBe(1800);
  });

  it('食べ途中の食事枠は、食べた分を差し引いた食べ足す分', () => {
    // 昼と夜で 1800 + 300 を半分ずつ分け、昼は 300 食べたので残り 750
    const eaten = [meal('lunch', 300)];
    expect(
      targetFor(remaining, 'lunch', DEFAULT_MEAL_SPLIT, eaten, at('13:00'))
        .calories,
    ).toBe(750);
  });

  it('残りの食事の配分がどれも 0% なら等分にする', () => {
    const split = { breakfastEnd: 100, lunchEnd: 100 };
    expect(targetFor(remaining, 'lunch', split, [], at('11:00')).calories).toBe(
      900,
    );
  });
});
