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
 * 副菜 0〜2 品の組。P/F/C はカロリーに直した値（P・C は 4kcal/g、F は 9kcal/g）で持つ。
 * weight はその合計で、目標とのずれの下限を見積もるのに使う。
 */
interface SidePack<T extends PFC> {
  items: T[];
  p: number;
  f: number;
  c: number;
  weight: number;
  calories: number;
}

function toPack<T extends PFC>(items: T[]): SidePack<T> {
  let p = 0;
  let f = 0;
  let c = 0;
  let calories = 0;
  for (const item of items) {
    p += item.protein * 4;
    f += item.fat * 9;
    c += item.carbs * 4;
    calories += item.calories;
  }
  return { items, p, f, c, weight: p + f + c, calories };
}

/** 副菜の組すべて（無し・1 品・2 品）を weight の昇順で。組の中はカロリーの低い順。 */
function sidePacks<T extends PFC>(sides: readonly T[]): SidePack<T>[] {
  const sorted = [...sides].sort((a, b) => a.calories - b.calories);
  const packs = [toPack<T>([])];
  sorted.forEach((side, i) => {
    packs.push(toPack([side]));
    for (let j = i + 1; j < sorted.length; j += 1) {
      const other = sorted[j];
      if (other) packs.push(toPack([side, other]));
    }
  });
  return packs.sort((a, b) => a.weight - b.weight);
}

/** weight が value 以上になる最初の添字。 */
function lowerBound<T extends PFC>(packs: SidePack<T>[], value: number) {
  let lo = 0;
  let hi = packs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((packs[mid]?.weight ?? Infinity) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * 目標に最も近い組み合わせ。ずれは P/F/C それぞれの差をカロリーに直した二乗和で、
 * 栄養素ごとの量の違いに引きずられず、カロリーへの影響の大きさで比べられる。
 * 3 つの差の和を s とするとずれは s²/3 以上なので、主食ごとに副菜の組を「目標の残りとの weight の差」が
 * 小さい順に調べ、その下限がそれまでの最良を超えたら打ち切る。used の商品は使わない。
 */
function findBest<T extends PFC>(
  mains: readonly T[],
  packs: SidePack<T>[],
  used: Set<T>,
  target: PFC,
  calorieCap: number,
): T[] | undefined {
  let bestScore = Infinity;
  let best: T[] | undefined;
  for (const main of mains) {
    if (used.has(main) || main.calories > calorieCap) continue;
    const p = (target.protein - main.protein) * 4;
    const f = (target.fat - main.fat) * 9;
    const c = (target.carbs - main.carbs) * 4;
    const rest = p + f + c;
    let lo = lowerBound(packs, rest) - 1;
    let hi = lo + 1;
    for (;;) {
      const below = packs[lo];
      const above = packs[hi];
      const takeBelow =
        below !== undefined &&
        (above === undefined || rest - below.weight <= above.weight - rest);
      const pack = takeBelow ? below : above;
      if (!pack) break;
      const gap = pack.weight - rest;
      if ((gap * gap) / 3 >= bestScore) break;
      if (takeBelow) lo -= 1;
      else hi += 1;
      if (
        main.calories + pack.calories > calorieCap ||
        pack.items.some((item) => used.has(item))
      ) {
        continue;
      }
      const dp = pack.p - p;
      const df = pack.f - f;
      const dc = pack.c - c;
      const score = dp * dp + df * df + dc * dc;
      if (score < bestScore) {
        bestScore = score;
        best = [main, ...pack.items];
      }
    }
  }
  return best;
}

/**
 * 商品の組み合わせを探す関数を作る。副菜の組を前もって作るので、同じ商品で目標を変えて何度も探すときは使い回す。
 * 返す関数は、目標の PFC に近い組み合わせを近い順に最大 count 件返す。
 * 似た案ばかりにならないよう、1 つの商品は 1 つの組み合わせにしか使わない。
 */
export function mealCombinationFinder<T extends PFC>({
  mains,
  sides,
}: MealCandidates<T>) {
  const packs = sidePacks(sides);
  return (target: PFC, count: number): MealCombination<T>[] => {
    if (target.calories <= 0) return [];
    const calorieCap = target.calories * CALORIE_TOLERANCE;
    const used = new Set<T>();
    const combinations: MealCombination<T>[] = [];
    while (combinations.length < count) {
      const best = findBest(mains, packs, used, target, calorieCap);
      if (!best) break;
      combinations.push({ items: best, total: sumPFC(best) });
      for (const item of best) used.add(item);
    }
    return combinations;
  };
}
