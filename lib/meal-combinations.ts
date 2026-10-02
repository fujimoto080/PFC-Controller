import { sumPFC } from '@/lib/pfc';
import type { PFC } from '@/lib/types';

/** 目標カロリーをこの割合まで超える組み合わせは候補にする。 */
const CALORIE_TOLERANCE = 1.1;

export interface MealCombination<T extends PFC> {
  items: T[];
  total: PFC;
}

/** 組み合わせに使う商品。1 食は主食 1 品と副菜 0〜2 品。 */
export interface MealCandidates<T extends PFC> {
  mains: readonly T[];
  sides: readonly T[];
}

/**
 * 目標とのずれ。P/F/C それぞれの差をカロリー（P・C は 4kcal/g、F は 9kcal/g）に直した二乗和。
 * 栄養素ごとの量の違いに引きずられず、カロリーへの影響の大きさで比べられる。
 */
function deviation(
  protein: number,
  fat: number,
  carbs: number,
  target: PFC,
): number {
  const p = (protein - target.protein) * 4;
  const f = (fat - target.fat) * 9;
  const c = (carbs - target.carbs) * 4;
  return p * p + f * f + c * c;
}

/**
 * 目標に最も近い組み合わせ。mains・sides はカロリーの昇順に並んでいること。
 * 組み合わせの数が多いので、ループ中は配列を作らずに添字だけ覚えておく（副菜の -1 は無し）。
 */
function findBest<T extends PFC>(
  { mains, sides }: MealCandidates<T>,
  target: PFC,
  calorieCap: number,
): T[] | undefined {
  let bestScore = Infinity;
  let best = { main: -1, side: -1, other: -1 };
  for (let m = 0; m < mains.length; m += 1) {
    const main = mains[m];
    if (!main || main.calories > calorieCap) break;
    const score = deviation(main.protein, main.fat, main.carbs, target);
    if (score < bestScore) {
      bestScore = score;
      best = { main: m, side: -1, other: -1 };
    }
    for (let i = 0; i < sides.length; i += 1) {
      const side = sides[i];
      if (!side) continue;
      const calories = main.calories + side.calories;
      // カロリーの昇順なので、以降の副菜はすべて上限を超える
      if (calories > calorieCap) break;
      const protein = main.protein + side.protein;
      const fat = main.fat + side.fat;
      const carbs = main.carbs + side.carbs;
      const pairScore = deviation(protein, fat, carbs, target);
      if (pairScore < bestScore) {
        bestScore = pairScore;
        best = { main: m, side: i, other: -1 };
      }
      for (let j = i + 1; j < sides.length; j += 1) {
        const other = sides[j];
        if (!other || calories + other.calories > calorieCap) break;
        const tripleScore = deviation(
          protein + other.protein,
          fat + other.fat,
          carbs + other.carbs,
          target,
        );
        if (tripleScore < bestScore) {
          bestScore = tripleScore;
          best = { main: m, side: i, other: j };
        }
      }
    }
  }
  const main = mains[best.main];
  if (!main) return undefined;
  return [main, sides[best.side], sides[best.other]].filter(
    (item): item is T => item !== undefined,
  );
}

const byCalories = <T extends PFC>(items: readonly T[]) =>
  [...items].sort((a, b) => a.calories - b.calories);

/**
 * 目標の PFC に近い商品の組み合わせを、近い順に最大 count 件。
 * 似た案ばかりにならないよう、1 つの商品は 1 つの組み合わせにしか使わない。
 */
export function findMealCombinations<T extends PFC>(
  candidates: MealCandidates<T>,
  target: PFC,
  count: number,
): MealCombination<T>[] {
  if (target.calories <= 0) return [];
  const calorieCap = target.calories * CALORIE_TOLERANCE;
  let mains = byCalories(candidates.mains);
  let sides = byCalories(candidates.sides);
  const combinations: MealCombination<T>[] = [];
  while (combinations.length < count) {
    const best = findBest({ mains, sides }, target, calorieCap);
    if (!best) break;
    combinations.push({ items: best, total: sumPFC(best) });
    mains = mains.filter((item) => !best.includes(item));
    sides = sides.filter((item) => !best.includes(item));
  }
  return combinations;
}
