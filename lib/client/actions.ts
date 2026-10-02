'use client';

import { buildFoodMatchKey, toBarcodeFood } from '@/lib/barcode';
import { api, saveBarcodeMapping } from '@/lib/client/api';
import {
  getState,
  optimistic,
  setState,
  type AppState,
} from '@/lib/client/store';
import { DEFAULT_PROFILE } from '@/lib/nutrition-goals';
import { sumPFC } from '@/lib/pfc';
import { buildSportActivity, type SportIntensity } from '@/lib/sports';
import {
  createEmptyDailyLog,
  type DailyLog,
  type FoodItem,
  type FoodItemInput,
  type Logs,
  type MealNote,
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

function replaceLogItem(logs: Logs, id: string, item: FoodItem): Logs {
  return updateDay(logs, formatDate(item.timestamp), (log) => ({
    items: log.items.map((it) => (it.id === id ? item : it)),
  }));
}

export function addFoodItem(input: FoodItemInput): Promise<boolean> {
  const id = tempId();
  const date = formatDate(input.timestamp);
  return optimistic({
    apply: withLogs((logs) =>
      updateDay(logs, date, (log) => ({
        items: [...log.items, { ...input, id }],
      })),
    ),
    request: () => api.post<FoodItem>('/api/log-items', input),
    errorMessage: '食事記録の追加に失敗しました',
    onSuccess: (current, saved) =>
      withLogs((logs) => replaceLogItem(logs, id, saved))(current),
  });
}

export function updateLogItem(item: FoodItem): Promise<boolean> {
  const { id, ...input } = item;
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

export function addFood(item: FoodItem): Promise<boolean> {
  return optimistic({
    apply: withFoods((foods) => [...foods, item]),
    request: () => api.post('/api/foods', item),
    errorMessage: '食品の保存に失敗しました',
  });
}

/**
 * 記録した食品を次回から選べるよう残す。同じ内容が食品リストに無ければ追加し、
 * バーコードがあれば食品情報を紐付ける。保存しなかったものは undefined。
 */
export function rememberFood(food: FoodItemInput, barcode?: string) {
  const matchKey = buildFoodMatchKey(food);
  const exists = getState().foods.some(
    (saved) => buildFoodMatchKey(saved) === matchKey,
  );
  return {
    foodAdded: exists
      ? undefined
      : addFood({ ...food, id: crypto.randomUUID() }),
    mappingSaved: barcode
      ? saveBarcodeMapping([barcode], toBarcodeFood(food))
      : undefined,
  };
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

/** その日の超過・不足を繰り越すかどうかを切り替える。 */
export function toggleCarryoverExcludedDate(date: string): Promise<boolean> {
  return updateSettings({
    carryoverExcludedDates: toggleItem(
      getState().settings.carryoverExcludedDates,
      date,
    ),
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
    : { date: today, note: '', suggestions: [] };
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
