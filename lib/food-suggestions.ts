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

type FoodLabel = Pick<FoodItem, 'name' | 'store'>;

interface SearchCandidate {
  food: FoodItem;
  key?: string;
  label?: ReturnType<typeof normalizeFoodLabel>;
}

function normalizeFoodLabel(food: FoodLabel) {
  return {
    name: normalizeFoodName(food.name),
    store: normalizeFoodName(food.store ?? ''),
  };
}

/** 全体の語句が含まれるか、空白区切りの各語が食品名・店名に含まれれば一致する。 */
function matchNormalizedFoodQuery(query: string) {
  const whole = normalizeFoodName(query);
  const terms = query.split(/[\s　]+/).map(normalizeFoodName);
  return ({ name, store }: ReturnType<typeof normalizeFoodLabel>): boolean =>
    name.includes(whole) ||
    store.includes(whole) ||
    terms.every((term) => name.includes(term) || store.includes(term));
}

export function foodQueryMatcher(query: string) {
  const matches = matchNormalizedFoodQuery(query);
  return (food: FoodLabel): boolean => matches(normalizeFoodLabel(food));
}

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
 * 履歴の並べ替えは一度だけ行い、検索で必要になった食品名の正規化結果を使い回す。
 */
export function createFoodCandidateSearch(
  foods: FoodItem[],
  logs: Logs,
  aliases: Record<string, FoodAlias>,
) {
  const foodsById = new Map(foods.map((food) => [food.id, food]));
  const aliasLabels = Object.values(aliases).map((alias) => ({
    foodId: alias.foodId,
    label: normalizeFoodLabel(alias),
  }));
  const history = Object.values(logs)
    .flatMap((log) => log.items)
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(({ unitPfc, quantity: _, ...food }) => {
      const candidate = { ...food, ...unitPfc };
      const alias =
        aliasLabels.length > 0
          ? aliases[foodCandidateKey(candidate)]
          : undefined;
      return (alias && foodsById.get(alias.foodId)) ?? candidate;
    });

  const candidates: SearchCandidate[] = [...history, ...foods].map((food) => ({
    food,
  }));

  return (query: string): FoodItem[] => {
    const trimmed = query.trim();
    const matches = trimmed ? matchNormalizedFoodQuery(trimmed) : undefined;
    const matchingAliases = matches
      ? new Set(
          aliasLabels
            .filter(({ label }) => matches(label))
            .map(({ foodId }) => foodId),
        )
      : undefined;
    const results = new Map<string, FoodItem>();
    for (const candidate of candidates) {
      const { food } = candidate;
      if (
        matches &&
        !matchingAliases?.has(food.id) &&
        !matches((candidate.label ??= normalizeFoodLabel(food)))
      ) {
        continue;
      }
      const key = (candidate.key ??= foodCandidateKey(food));
      if (!results.has(key)) results.set(key, food);
    }
    return [...results.values()];
  };
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
