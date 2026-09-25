'use client';

import { api } from '@/lib/client/api';
import { getState, optimistic, type AppState } from '@/lib/client/store';
import { sumPFC } from '@/lib/pfc';
import {
  createEmptyDailyLog,
  type DailyLog,
  type FoodItem,
  type FoodItemInput,
  type Logs,
  type SportActivityInput,
  type SportActivityLog,
  type SportDefinition,
  type UserSettings,
} from '@/lib/types';
import { formatDate, toggleItem, toJstTimestamp } from '@/lib/utils';

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
    request: () =>
      api.post<FoodItem>(
        '/api/log-items',
        input,
        '食事記録の追加に失敗しました',
      ),
    errorLabel: '追加に失敗しました',
    onSuccess: (current, saved) =>
      withLogs((logs) => replaceLogItem(logs, id, saved))(current),
  });
}

/** 既存の食品（辞書・過去の記録）を指定時刻の記録として追加する。 */
export function logFood(
  { id: _id, ...food }: FoodItem,
  timestamp: number,
): Promise<boolean> {
  return addFoodItem({ ...food, timestamp });
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
    request: () =>
      api.patch(
        `/api/log-items/${encodeURIComponent(id)}`,
        input,
        '食事記録の更新に失敗しました',
      ),
    errorLabel: '更新に失敗しました',
  });
}

export function deleteLogItem(id: string): Promise<boolean> {
  return optimistic({
    apply: withLogs((logs) => removeLogItem(logs, id)),
    request: () =>
      api.delete(
        `/api/log-items/${encodeURIComponent(id)}`,
        '食事記録の削除に失敗しました',
      ),
    errorLabel: '削除に失敗しました',
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
    request: () => api.post('/api/foods', item, '食品の保存に失敗しました'),
    errorLabel: '食品の保存に失敗しました',
  });
}

export function updateFood(item: FoodItem): Promise<boolean> {
  const { id, ...input } = item;
  return optimistic({
    apply: withFoods((foods) =>
      foods.map((food) => (food.id === id ? item : food)),
    ),
    request: () =>
      api.patch(
        `/api/foods/${encodeURIComponent(id)}`,
        input,
        '食品の更新に失敗しました',
      ),
    errorLabel: '食品の更新に失敗しました',
  });
}

export function deleteFood(id: string): Promise<boolean> {
  return optimistic({
    apply: withFoods((foods) => foods.filter((food) => food.id !== id)),
    request: () =>
      api.delete(
        `/api/foods/${encodeURIComponent(id)}`,
        '食品の削除に失敗しました',
      ),
    errorLabel: '食品の削除に失敗しました',
  });
}

export function saveSettings(settings: UserSettings): Promise<boolean> {
  return optimistic({
    apply: (current) => ({ ...current, settings }),
    request: () =>
      api.put('/api/settings', settings, '設定の保存に失敗しました'),
    errorLabel: '設定の保存に失敗しました',
  });
}

export function toggleFavoriteFood(id: string): Promise<boolean> {
  const { settings } = getState();
  return saveSettings({
    ...settings,
    favoriteFoodIds: toggleItem(settings.favoriteFoodIds, id),
  });
}

export function saveSports(sports: SportDefinition[]): Promise<boolean> {
  return optimistic({
    apply: (current) => ({ ...current, sports }),
    request: () =>
      api.put('/api/sports', sports, 'スポーツの保存に失敗しました'),
    errorLabel: 'スポーツの保存に失敗しました',
  });
}

/** 今日なら現在時刻、それ以外はその日の正午(JST)を記録時刻にする。 */
function timestampForDate(date: string): number {
  const now = Date.now();
  return formatDate(now) === date ? now : toJstTimestamp(date, '12:00');
}

export function addSportActivity(
  date: string,
  sport: SportDefinition,
): Promise<boolean> {
  const id = tempId();
  const input: SportActivityInput = {
    sportId: sport.id,
    name: sport.name,
    caloriesBurned: sport.caloriesBurned,
    timestamp: timestampForDate(date),
  };
  return optimistic({
    apply: withLogs((logs) =>
      updateDay(logs, date, (log) => ({
        activities: [...log.activities, { ...input, id }],
      })),
    ),
    request: () =>
      api.post<SportActivityLog>(
        '/api/log-activities',
        input,
        '運動記録の追加に失敗しました',
      ),
    errorLabel: '運動の追加に失敗しました',
    onSuccess: (current, saved) =>
      withLogs((logs) =>
        updateDay(logs, date, (log) => ({
          activities: log.activities.map((activity) =>
            activity.id === id ? saved : activity,
          ),
        })),
      )(current),
  });
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
    request: () =>
      api.delete(
        `/api/log-activities/${encodeURIComponent(id)}`,
        '運動記録の削除に失敗しました',
      ),
    errorLabel: '運動の削除に失敗しました',
  });
}
