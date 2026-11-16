'use client';

import { foodDictionaryKey } from '@/lib/barcode';
import type { SavedScanEntry } from '@/lib/scan-batch';
import { api } from '@/lib/client/api';
import {
  getState,
  optimistic,
  setState,
  type AppState,
} from '@/lib/client/store';
import { DEFAULT_MEAL_SPLIT } from '@/lib/meal-split';
import { DEFAULT_PROFILE } from '@/lib/nutrition-goals';
import { buildLogItem, sumPFC } from '@/lib/pfc';
import { buildSportActivity, type SportIntensity } from '@/lib/sports';
import { toast } from '@/lib/toast';
import {
  createEmptyDailyLog,
  type DailyLog,
  type FoodAlias,
  type FoodItem,
  type FoodItemInput,
  type LogItem,
  type LogItemInput,
  type Logs,
  type MealNote,
  type MealSplit,
  type MealSuggestion,
  type MealSuggestionRequest,
  type SportActivityLog,
  type SportDefinition,
  type TodayMeal,
  type UserSettings,
} from '@/lib/types';
import { defaultTimestampFor, formatDate, toggleItem } from '@/lib/utils';

// 各操作は楽観的に即時反映し、失敗時はロールバックとエラートーストまで行う。戻り値は成否。

const tempId = () => `tmp-${crypto.randomUUID()}`;

function updateDay(
  logs: Logs,
  date: string,
  fn: (log: DailyLog) => Partial<DailyLog>,
): Logs {
  const log = logs[date] ?? createEmptyDailyLog(date);
  const next = { ...log, ...fn(log) };
  return { ...logs, [date]: { ...next, total: sumPFC(next.items) } };
}

function findLogItemDate(logs: Logs, id: string): string | undefined {
  return Object.values(logs).find((log) =>
    log.items.some((item) => item.id === id),
  )?.date;
}

function withLogs(fn: (logs: Logs) => Logs) {
  return (current: AppState): AppState => ({
    ...current,
    logs: fn(current.logs),
  });
}

function removeLogItem(logs: Logs, id: string): Logs {
  const date = findLogItemDate(logs, id);
  if (!date) return logs;
  return updateDay(logs, date, (log) => ({
    items: log.items.filter((item) => item.id !== id),
  }));
}

function replaceLogItem(logs: Logs, id: string, item: LogItem): Logs {
  return updateDay(logs, formatDate(item.timestamp), (log) => ({
    items: log.items.map((it) => (it.id === id ? item : it)),
  }));
}

export function addFoodItem(input: LogItemInput): Promise<boolean> {
  const id = tempId();
  const item = buildLogItem(id, input);
  const date = formatDate(item.timestamp);
  return optimistic({
    apply: withLogs((logs) =>
      updateDay(logs, date, (log) => ({
        items: [...log.items, item],
      })),
    ),
    request: () => api.post<LogItem>('/api/log-items', input),
    errorMessage: '食事記録の追加に失敗しました',
    onSuccess: (current, saved) =>
      withLogs((logs) => replaceLogItem(logs, id, saved))(current),
  });
}

export function updateLogItem({
  id,
  ...input
}: LogItemInput & { id: string }): Promise<boolean> {
  const item = buildLogItem(id, input);
  return optimistic({
    apply: withLogs((logs) => {
      const removed = removeLogItem(logs, id);
      return updateDay(removed, formatDate(item.timestamp), (log) => ({
        items: [...log.items, item],
      }));
    }),
    request: () => api.patch(`/api/log-items/${encodeURIComponent(id)}`, input),
    errorMessage: '食事記録の更新に失敗しました',
  });
}

export function deleteLogItem(id: string): Promise<boolean> {
  return optimistic({
    apply: withLogs((logs) => removeLogItem(logs, id)),
    request: () => api.delete(`/api/log-items/${encodeURIComponent(id)}`),
    errorMessage: '食事記録の削除に失敗しました',
  });
}

function withFoods(fn: (foods: FoodItem[]) => FoodItem[]) {
  return (current: AppState): AppState => ({
    ...current,
    foods: fn(current.foods),
  });
}

function addFood(item: FoodItem): Promise<boolean> {
  return optimistic({
    apply: withFoods((foods) => [...foods, item]),
    request: () => api.post('/api/foods', item),
    errorMessage: '食品の保存に失敗しました',
  });
}

/**
 * 同じ店舗・グループ・栄養値の食品がリストに無ければ追加する。
 */
export function hasRememberedFood(food: FoodItemInput): boolean {
  const matchKey = foodDictionaryKey(food);
  return getState().foods.some(
    (saved) => foodDictionaryKey(saved) === matchKey,
  );
}

export function rememberFood(food: FoodItemInput): Promise<boolean> {
  return hasRememberedFood(food)
    ? Promise.resolve(true)
    : addFood({ ...food, id: crypto.randomUUID() });
}

/** 一括保存済みの記録・食品をストアに反映する。再送時は同じ ID の項目を追加しない。 */
export function applySavedScanEntries(entries: SavedScanEntry[]) {
  if (entries.length === 0) return;
  setState((current) => {
    let logs = current.logs;
    const foods = new Map(current.foods.map((food) => [food.id, food]));
    for (const { item, food } of entries) {
      logs = updateDay(
        removeLogItem(logs, item.id),
        formatDate(item.timestamp),
        (log) => ({ items: [...log.items, item] }),
      );
      if (food) foods.set(food.id, food);
    }
    return { ...current, logs, foods: [...foods.values()] };
  });
}

export function updateFood(item: FoodItem): Promise<boolean> {
  const { id, ...input } = item;
  return optimistic({
    apply: withFoods((foods) =>
      foods.map((food) => (food.id === id ? item : food)),
    ),
    request: () => api.patch(`/api/foods/${encodeURIComponent(id)}`, input),
    errorMessage: '食品の更新に失敗しました',
  });
}

export function deleteFood(id: string): Promise<boolean> {
  return optimistic({
    apply: withFoods((foods) => foods.filter((food) => food.id !== id)),
    request: () => api.delete(`/api/foods/${encodeURIComponent(id)}`),
    errorMessage: '食品の削除に失敗しました',
  });
}

export async function mergeFoods(
  targetId: string,
  sourceIds: string[],
): Promise<boolean> {
  try {
    const { foodAliases, favoriteFoodIds } = await api.post<{
      foodAliases: Record<string, FoodAlias>;
      favoriteFoodIds: string[];
    }>('/api/foods/merge', { targetId, sourceIds });
    const sources = new Set(sourceIds);
    setState((current) => ({
      ...current,
      foodAliases,
      foods: current.foods.filter(({ id }) => !sources.has(id)),
      settings: { ...current.settings, favoriteFoodIds },
    }));
    return true;
  } catch (error) {
    toast.fromError('食品の名寄せに失敗しました', error);
    return false;
  }
}

/** 保存時点の最新の設定に patch を重ねて保存する。別の画面・パネルの変更を上書きしない。 */
export function updateSettings(patch: Partial<UserSettings>): Promise<boolean> {
  const settings = { ...getState().settings, ...patch };
  return optimistic({
    apply: (current) => ({ ...current, settings }),
    request: () => api.put('/api/settings', settings),
    errorMessage: '設定の保存に失敗しました',
  });
}

export function toggleFavoriteFood(id: string): Promise<boolean> {
  return updateSettings({
    favoriteFoodIds: toggleItem(getState().settings.favoriteFoodIds, id),
  });
}

export function saveSports(sports: SportDefinition[]): Promise<boolean> {
  return optimistic({
    apply: (current) => ({ ...current, sports }),
    request: () => api.put('/api/sports', sports),
    errorMessage: 'スポーツの保存に失敗しました',
  });
}

/** 仮 ID の記録はまだサーバーに保存されていないため、削除などの操作はできない。 */
export const isTempId = (id: string) => id.startsWith('tmp-');

/** 運動を記録する。成功時は保存された記録の ID（取り消し用）、失敗時は null を返す。 */
export async function addSportActivity(
  date: string,
  sport: SportDefinition,
  options: { intensity: SportIntensity; minutes: number },
): Promise<string | null> {
  const id = tempId();
  let savedId: string | null = null;
  const input = buildSportActivity(sport, {
    ...options,
    weight: (getState().settings.profile ?? DEFAULT_PROFILE).weight,
    timestamp: defaultTimestampFor(date),
  });
  await optimistic({
    apply: withLogs((logs) =>
      updateDay(logs, date, (log) => ({
        activities: [...log.activities, { ...input, id }],
      })),
    ),
    request: () => api.post<SportActivityLog>('/api/log-activities', input),
    errorMessage: '運動記録の追加に失敗しました',
    onSuccess: (current, saved) => {
      savedId = saved.id;
      return withLogs((logs) =>
        updateDay(logs, date, (log) => ({
          activities: log.activities.map((activity) =>
            activity.id === id ? saved : activity,
          ),
        })),
      )(current);
    },
  });
  return savedId;
}

export function deleteSportActivity(
  date: string,
  id: string,
): Promise<boolean> {
  return optimistic({
    apply: withLogs((logs) =>
      updateDay(logs, date, (log) => ({
        activities: log.activities.filter((activity) => activity.id !== id),
      })),
    ),
    request: () => api.delete(`/api/log-activities/${encodeURIComponent(id)}`),
    errorMessage: '運動記録の削除に失敗しました',
  });
}

/** 今日の食事提案と予定・気分。キャッシュが前日以前のものなら空として扱う。 */
export function todayMeal(meal: TodayMeal): TodayMeal {
  const today = formatDate(Date.now());
  return meal.date === today
    ? meal
    : {
        date: today,
        note: '',
        split: { ...DEFAULT_MEAL_SPLIT },
        suggestions: [],
      };
}

function withTodayMeal(fn: (meal: TodayMeal) => TodayMeal) {
  return (current: AppState): AppState => ({
    ...current,
    meal: fn(todayMeal(current.meal)),
  });
}

/** 今日の予定・気分（食事提案に使う）を保存する。 */
export function saveMealNote(note: string): Promise<boolean> {
  return optimistic({
    apply: withTodayMeal((meal) => ({ ...meal, note })),
    request: () => api.put('/api/meal-note', { note } satisfies MealNote),
    errorMessage: '今日の予定・気分の保存に失敗しました',
  });
}

/** 今日の朝昼晩のカロリー配分（食事提案に使う）を保存する。 */
export function saveMealSplit(split: MealSplit): Promise<boolean> {
  return optimistic({
    apply: withTodayMeal((meal) => ({ ...meal, split })),
    request: () => api.put('/api/meal-split', split),
    errorMessage: '朝昼晩の配分の保存に失敗しました',
  });
}

/**
 * AI に食事を提案させ（食事枠ごとに 1 件）、今日の提案の先頭に加える。Web 検索を伴うため数十秒かかる。
 * 待つ間の他の変更を巻き戻さないよう、失敗時は楽観的更新をせず throw する。
 */
export async function requestMealSuggestions(
  request: MealSuggestionRequest,
): Promise<void> {
  const created = await api.post<MealSuggestion[]>(
    '/api/meal-suggestions',
    request,
  );
  setState(
    withTodayMeal((meal) => ({
      ...meal,
      suggestions: [...created, ...meal.suggestions],
    })),
  );
}
