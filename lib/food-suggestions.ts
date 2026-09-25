import { buildFoodMatchKey } from '@/lib/barcode';
import type { FoodItem, Logs, PFC } from '@/lib/types';

const MAX_SUGGESTIONS = 5;

const normalizeFoodName = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s　\-_ー・]+/g, '');

const calcLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const deletion = (prev[j] ?? 0) + 1;
      const insertion = (curr[j - 1] ?? 0) + 1;
      const substitution = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(deletion, insertion, substitution);
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j] ?? 0;
    }
  }

  return prev[b.length] ?? 0;
};

const calcSimilarityScore = (input: string, target: string): number => {
  if (!input || !target) return 0;
  if (target.includes(input)) return 1;

  const maxLength = Math.max(input.length, target.length);
  if (maxLength === 0) return 0;

  const distance = calcLevenshteinDistance(input, target);
  return 1 - distance / maxLength;
};

export function getSimilarFoodSuggestions(
  foods: FoodItem[],
  inputName: string,
): (FoodItem & { similarityScore: number })[] {
  const normalizedInput = normalizeFoodName(inputName.trim());
  if (normalizedInput.length < 2) return [];

  return foods
    .map((food) => {
      const normalizedName = normalizeFoodName(food.name);
      return {
        ...food,
        similarityScore: calcSimilarityScore(normalizedInput, normalizedName),
      };
    })
    .filter((food) => food.similarityScore >= 0.5)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, MAX_SUGGESTIONS);
}

const MAX_CANDIDATES = 30;

/**
 * 記録追加で選べる食品候補。過去の記録（新しい順）→ 食品リストの順に並べ、同じ内容のものは 1 件にまとめる。
 * query が空なら全件、そうでなければ食品名に query を含むものに絞る。
 */
export function searchFoodCandidates(
  foods: FoodItem[],
  logs: Logs,
  query: string,
): FoodItem[] {
  const normalizedQuery = normalizeFoodName(query.trim());
  const history = Object.values(logs)
    .flatMap((log) => log.items)
    .sort((a, b) => b.timestamp - a.timestamp);

  const candidates = new Map<string, FoodItem>();
  for (const food of [...history, ...foods]) {
    if (!normalizeFoodName(food.name).includes(normalizedQuery)) continue;
    const key = buildFoodMatchKey(food);
    if (!candidates.has(key)) candidates.set(key, food);
    if (candidates.size >= MAX_CANDIDATES) break;
  }
  return [...candidates.values()];
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
