import { findMealCombinations } from '@/lib/meal-combinations';
import type { PFC } from '@/lib/types';

const food = (name: string, protein: number, fat: number, carbs: number) => ({
  name,
  protein,
  fat,
  carbs,
  calories: protein * 4 + fat * 9 + carbs * 4,
});

const names = (combination: { items: { name: string }[] }) =>
  combination.items.map((item) => item.name);

const onigiri = food('おにぎり', 4, 2, 40);
const bento = food('弁当', 25, 25, 100);
const chicken = food('サラダチキン', 25, 1, 0);
const salad = food('サラダ', 2, 5, 8);
const egg = food('ゆでたまご', 6, 5, 0);

describe('findMealCombinations', () => {
  const candidates = {
    mains: [bento, onigiri],
    sides: [chicken, salad, egg],
  };

  it('主食 1 品と副菜 0〜2 品で目標に最も近い組み合わせを先頭にする', () => {
    const target: PFC = food('目標', 31, 7, 40);
    const [best] = findMealCombinations(candidates, target, 1);
    expect(best && names(best)).toEqual([
      'おにぎり',
      'ゆでたまご',
      'サラダチキン',
    ]);
    expect(best?.total).toEqual({
      protein: 35,
      fat: 8,
      carbs: 40,
      calories: 372,
    });
  });

  it('1 つの商品は 1 つの組み合わせにしか使わない', () => {
    const combinations = findMealCombinations(
      candidates,
      food('目標', 30, 30, 140),
      5,
    );
    const used = combinations.flatMap(names);
    expect(new Set(used).size).toBe(used.length);
    expect(combinations).toHaveLength(2);
  });

  it('目標カロリーの 1.1 倍を超える組み合わせは選ばない', () => {
    const combinations = findMealCombinations(
      candidates,
      food('目標', 4, 2, 40),
      5,
    );
    expect(combinations.map(names)).toEqual([['おにぎり']]);
  });

  it('目標カロリーが残っていなければ提案しない', () => {
    expect(
      findMealCombinations(
        candidates,
        { ...food('目標', 10, 10, 10), calories: 0 },
        5,
      ),
    ).toEqual([]);
  });
});
