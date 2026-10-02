/** @jest-environment node */
import { DEFAULT_MEAL_SPLIT, slotFraction } from '@/lib/meal-split';
import { targetFor } from '@/lib/server/combination-suggestions';

// DB まで読み込まないよう、DB を読むモジュールは差し替える
jest.mock('@/lib/server/meal-context', () => ({}));
jest.mock('@/lib/server/meal-splits', () => ({}));

describe('slotFraction', () => {
  it('朝から考えるときは配分どおりの割合', () => {
    const split = { breakfastEnd: 20, lunchEnd: 50 };
    expect(slotFraction(split, 'breakfast')).toBeCloseTo(0.2);
    expect(slotFraction(split, 'lunch')).toBeCloseTo(0.3 / 0.8);
    expect(slotFraction(split, 'dinner')).toBe(1);
  });

  it('残りの食事の配分がどれも 0% なら等分にする', () => {
    const split = { breakfastEnd: 100, lunchEnd: 100 };
    expect(slotFraction(split, 'lunch')).toBe(1 / 2);
  });
});

describe('targetFor', () => {
  const remaining = { protein: 90, fat: 30, carbs: 300, calories: 1800 };

  it('残りを配分の比率で割り当てる', () => {
    const split = { breakfastEnd: 25, lunchEnd: 50 };
    expect(targetFor(remaining, 'breakfast', split)).toEqual({
      protein: 22.5,
      fat: 7.5,
      carbs: 75,
      calories: 450,
    });
  });

  it('昼の分を食べ終えたら、夜には残りすべてを割り当てる', () => {
    const lunch = targetFor(remaining, 'lunch', DEFAULT_MEAL_SPLIT);
    expect(lunch.calories).toBe(900);
    const left = {
      ...remaining,
      calories: remaining.calories - lunch.calories,
    };
    expect(targetFor(left, 'dinner', DEFAULT_MEAL_SPLIT).calories).toBe(900);
  });
});
