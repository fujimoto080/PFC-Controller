import { sumPFC } from '@/lib/pfc';
import type { PFC } from '@/lib/types';

/** 目標カロリーをこの割合まで超える組み合わせは候補にする。 */
const CALORIE_TOLERANCE = 1.05;
const PACK_BLOCK_SIZE = 32;

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

interface PackBounds {
  minCalories: number;
  minP: number;
  maxP: number;
  minF: number;
  maxF: number;
  minC: number;
  maxC: number;
}

/** weight 順の並びを粗く区切り、副菜の組をまとめて除外するための上下限を取る。 */
function packBounds<T extends PFC>(packs: SidePack<T>[]): PackBounds[] {
  const blocks: PackBounds[] = [];
  for (let i = 0; i < packs.length; i += PACK_BLOCK_SIZE) {
    const block = {
      minCalories: Infinity,
      minP: Infinity,
      maxP: -Infinity,
      minF: Infinity,
      maxF: -Infinity,
      minC: Infinity,
      maxC: -Infinity,
    };
    for (const { calories, p, f, c } of packs.slice(i, i + PACK_BLOCK_SIZE)) {
      block.minCalories = Math.min(block.minCalories, calories);
      block.minP = Math.min(block.minP, p);
      block.maxP = Math.max(block.maxP, p);
      block.minF = Math.min(block.minF, f);
      block.maxF = Math.max(block.maxF, f);
      block.minC = Math.min(block.minC, c);
      block.maxC = Math.max(block.maxC, c);
    }
    blocks.push(block);
  }
  return blocks;
}

function blockScore(block: PackBounds, p: number, f: number, c: number) {
  const dp = Math.max(block.minP - p, p - block.maxP, 0);
  const df = Math.max(block.minF - f, f - block.maxF, 0);
  const dc = Math.max(block.minC - c, c - block.maxC, 0);
  return 2 * dp * dp + df * df + dc * dc;
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
 * たんぱく質の差を2倍の重みで優先し、カロリーへの影響で比べる。
 * 3 つの差の和を s とするとずれは s²/3 以上なので、主食ごとに副菜の組を「目標の残りとの weight の差」が
 * 小さい順に調べ、その下限がそれまでの最良を超えたら打ち切る。used の商品は使わない。
 * 各ブロックに入るとき、最小カロリーと P/F/C の範囲から、ブロック全体を除外できるか確認する。
 */
function findBest<T extends PFC>(
  mains: readonly T[],
  packs: SidePack<T>[],
  bounds: PackBounds[],
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
    let checkedBelow = -1;
    let checkedAbove = -1;
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
      const index = Math.floor((takeBelow ? lo : hi) / PACK_BLOCK_SIZE);
      if (index !== (takeBelow ? checkedBelow : checkedAbove)) {
        const block = bounds[index];
        if (
          block &&
          (main.calories + block.minCalories > calorieCap ||
            blockScore(block, p, f, c) >= bestScore)
        ) {
          if (takeBelow) lo = index * PACK_BLOCK_SIZE - 1;
          else hi = (index + 1) * PACK_BLOCK_SIZE;
          continue;
        }
        if (takeBelow) checkedBelow = index;
        else checkedAbove = index;
      }
      if (takeBelow) lo -= 1;
      else hi += 1;
      if (main.calories + pack.calories > calorieCap) continue;
      const dp = pack.p - p;
      const df = pack.f - f;
      const dc = pack.c - c;
      const score = 2 * dp * dp + df * df + dc * dc;
      if (score < bestScore && !pack.items.some((item) => used.has(item))) {
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
  const bounds = packBounds(packs);
  return (target: PFC, count: number): MealCombination<T>[] => {
    if (target.calories <= 0) return [];
    const calorieCap = target.calories * CALORIE_TOLERANCE;
    const used = new Set<T>();
    const combinations: MealCombination<T>[] = [];
    while (combinations.length < count) {
      const best = findBest(mains, packs, bounds, used, target, calorieCap);
      if (!best) break;
      combinations.push({ items: best, total: sumPFC(best) });
      for (const item of best) used.add(item);
    }
    return combinations;
  };
}
