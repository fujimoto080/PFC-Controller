import { buildFoodMatchKey, type BarcodeFood } from '@/lib/barcode';
import { MACROS } from '@/lib/macros';
import type { FoodAlias, FoodItem, Logs, PFC } from '@/lib/types';

const normalizeCandidateLabel = (value: string): string =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s_・-]+/g, '');

const normalizeFoodName = (value: string): string =>
  normalizeCandidateLabel(value).replace(/ー/g, '');

const MAX_CANDIDATES = 30;

interface FoodMergeCandidate {
  key: string;
  foods: [FoodItem, ...FoodItem[]];
}

/** P・F・C がすべて同じ食品が2件以上ある組を返す。 */
export function findFoodMergeCandidates(
  foods: readonly FoodItem[],
): FoodMergeCandidate[] {
  const groups = new Map<string, FoodMergeCandidate>();
  for (const food of foods) {
    const key = MACROS.map(({ key }) => food[key]).join('|');
    const group = groups.get(key);
    if (group) group.foods.push(food);
    else groups.set(key, { key, foods: [food] });
  }
  return [...groups.values()].filter((group) => group.foods.length >= 2);
}

export function foodCandidateKey(food: BarcodeFood): string {
  return JSON.stringify([
    normalizeCandidateLabel(food.store ?? ''),
    buildFoodMatchKey({ ...food, name: normalizeCandidateLabel(food.name) }),
  ]);
}

/**
 * 食品名か店名が検索語に当てはまるか。
 * 区切り文字を無視して食品名・店名のどちらかに含まれるか、空白区切りの各語が食品名・店名のいずれかに含まれれば当てはまる。
 */
export const matchesFoodQuery = (
  food: Pick<FoodItem, 'name' | 'store'>,
  query: string,
): boolean => {
  const name = normalizeFoodName(food.name);
  const store = normalizeFoodName(food.store ?? '');
  const matches = (term: string) => name.includes(term) || store.includes(term);
  if (matches(normalizeFoodName(query))) return true;
  return query
    .split(/[\s　]+/)
    .map(normalizeFoodName)
    .every(matches);
};

/** 食品名・店舗・栄養値が一致する候補は、先に出たものを残す。 */
export function uniqueFoodCandidates<T extends BarcodeFood>(
  foods: readonly T[],
  {
    limit = Infinity,
    filter,
  }: { limit?: number; filter?: (food: T) => boolean } = {},
): T[] {
  const candidates = new Map<string, T>();
  for (const food of foods) {
    if (candidates.size >= limit) break;
    if (filter && !filter(food)) continue;
    const key = foodCandidateKey(food);
    if (!candidates.has(key)) candidates.set(key, food);
  }
  return [...candidates.values()];
}

/**
 * 記録追加で選べる食品候補。過去の記録（新しい順）→ 食品リストの順に並べ、同じ内容のものは 1 件にまとめる。
 * query が空なら全件、そうでなければ食品名か店名が query に当てはまるものに絞る。
 */
export function searchFoodCandidates(
  foods: FoodItem[],
  logs: Logs,
  query: string,
  aliases: Record<string, FoodAlias>,
): FoodItem[] {
  const trimmedQuery = query.trim();
  const foodsById = new Map(foods.map((food) => [food.id, food]));
  const matchingAliases = new Set(
    Object.values(aliases)
      .filter((alias) => matchesFoodQuery(alias, trimmedQuery))
      .map((alias) => alias.foodId),
  );
  const history = Object.values(logs)
    .flatMap((log) => log.items)
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(({ unitPfc, quantity: _, ...food }) => {
      const candidate = { ...food, ...unitPfc };
      const alias = aliases[foodCandidateKey(candidate)];
      return (alias && foodsById.get(alias.foodId)) ?? candidate;
    });

  return uniqueFoodCandidates([...history, ...foods], {
    limit: MAX_CANDIDATES,
    filter: (food) =>
      matchingAliases.has(food.id) || matchesFoodQuery(food, trimmedQuery),
  });
}

export interface FrequentFood extends PFC {
  name: string;
  store?: string;
  count: number;
  /** YYYY-MM-DD */
  lastEatenDate: string;
}

/**
 * 記録を食品名（表記ゆれを正規化）ごとに集計し、食べた回数の多い順（同数なら最近食べた順）に返す。
 * 名前・店舗・栄養値は最後に食べた記録のものを使う。
 */
export function rankFrequentFoods(
  items: readonly (FoodItem & { date: string })[],
): FrequentFood[] {
  const byName = new Map<string, FrequentFood & { lastTimestamp: number }>();
  for (const item of items) {
    const key = normalizeFoodName(item.name);
    const current = byName.get(key);
    const isLatest = !current || item.timestamp >= current.lastTimestamp;
    const latest = isLatest ? item : current;
    byName.set(key, {
      name: latest.name,
      store: latest.store,
      protein: latest.protein,
      fat: latest.fat,
      carbs: latest.carbs,
      calories: latest.calories,
      count: (current?.count ?? 0) + 1,
      lastEatenDate: isLatest ? item.date : current.lastEatenDate,
      lastTimestamp: isLatest ? item.timestamp : current.lastTimestamp,
    });
  }
  return [...byName.values()]
    .sort((a, b) => b.count - a.count || b.lastTimestamp - a.lastTimestamp)
    .map(({ lastTimestamp: _, ...food }) => food);
}
