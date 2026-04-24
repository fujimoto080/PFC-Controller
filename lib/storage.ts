'use client';

import {
  DailyLog,
  FoodItem,
  UserSettings,
  DEFAULT_TARGET,
  PFC,
  SportActivityLog,
  SportDefinition,
} from './types';
import { formatDate, roundPFC } from './utils';
import { toast } from './toast';

const isClient = typeof window !== 'undefined';

const emptyTotals: PFC = { protein: 0, fat: 0, carbs: 0, calories: 0 };

type ResourceKey = 'logs' | 'settings' | 'foods' | 'sports';

interface CloudState {
  logs: Record<string, DailyLog>;
  settings: UserSettings;
  foods: FoodItem[];
  sports: SportDefinition[];
  loaded: boolean;
}

const getDefaultSports = (): SportDefinition[] => [
  { id: 'walking', name: 'ウォーキング', caloriesBurned: 180 },
  { id: 'running', name: 'ランニング', caloriesBurned: 320 },
  { id: 'cycling', name: 'サイクリング', caloriesBurned: 260 },
];

const cloudState: CloudState = {
  logs: {},
  settings: { targetPFC: DEFAULT_TARGET, sports: getDefaultSports() },
  foods: [],
  sports: getDefaultSports(),
  loaded: false,
};

const getDateFromTimestamp = (timestamp: number) =>
  formatDate(new Date(timestamp));

const getSortedLogDates = (
  logs: Record<string, DailyLog>,
  order: 'asc' | 'desc' = 'desc',
) =>
  Object.keys(logs).sort((a, b) =>
    order === 'asc' ? a.localeCompare(b) : b.localeCompare(a),
  );

const toSportDefinition = (sport: SportDefinition): SportDefinition => ({
  id: sport.id,
  name: sport.name,
  caloriesBurned: Math.max(0, roundPFC(sport.caloriesBurned)),
});

const normalizeSports = (sports: unknown): SportDefinition[] => {
  if (!Array.isArray(sports)) return [];

  return sports
    .filter(
      (sport): sport is SportDefinition =>
        !!sport &&
        typeof sport === 'object' &&
        typeof (sport as SportDefinition).id === 'string' &&
        typeof (sport as SportDefinition).name === 'string' &&
        typeof (sport as SportDefinition).caloriesBurned === 'number' &&
        Number.isFinite((sport as SportDefinition).caloriesBurned),
    )
    .map(toSportDefinition);
};

export function refreshUI() {
  if (isClient) {
    window.dispatchEvent(new Event('pfc-update'));
  }
}

function endpointFor(resource: ResourceKey): string {
  return `/api/cloud-data/${resource}`;
}

function payloadFor(resource: ResourceKey): Record<string, unknown> {
  switch (resource) {
    case 'logs':
      return { logs: cloudState.logs };
    case 'settings':
      return { settings: serializeSettings(cloudState.settings) };
    case 'foods':
      return { foods: cloudState.foods };
    case 'sports':
      return { sports: cloudState.sports };
  }
}

function serializeSettings(settings: UserSettings): Record<string, unknown> {
  return {
    targetPFC: settings.targetPFC,
    profile: settings.profile,
    favoriteFoodIds: settings.favoriteFoodIds ?? [],
    sports: settings.sports ?? [],
  };
}

async function syncResource(resource: ResourceKey) {
  if (!cloudState.loaded) return;

  try {
    const response = await fetch(endpointFor(resource), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadFor(resource)),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || 'クラウド保存に失敗しました');
    }
  } catch (error) {
    console.error(`クラウド同期失敗 (${resource})`, error);
    toast.error(
      error instanceof Error ? error.message : 'クラウド保存に失敗しました',
    );
  }
}

interface CloudFetchResponse {
  payload: {
    logs?: Record<string, DailyLog>;
    settings?: UserSettings & Record<string, unknown>;
    foods?: FoodItem[];
    sports?: SportDefinition[];
  } | null;
}

export async function loadCloudData(): Promise<boolean> {
  try {
    const response = await fetch('/api/cloud-data');
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || 'ユーザーデータ取得に失敗しました');
    }
    const data = (await response.json()) as CloudFetchResponse;

    const payload = data.payload;
    const settingsFromCloud = (payload?.settings ?? null) as
      | (UserSettings & Record<string, unknown>)
      | null;
    const sportsFromSettings = normalizeSports(settingsFromCloud?.sports);
    const sportsTopLevel = normalizeSports(payload?.sports);
    const resolvedSports =
      sportsTopLevel.length > 0
        ? sportsTopLevel
        : sportsFromSettings.length > 0
          ? sportsFromSettings
          : getDefaultSports();

    cloudState.logs = (payload?.logs ?? {}) as Record<string, DailyLog>;
    cloudState.foods = Array.isArray(payload?.foods) ? (payload!.foods as FoodItem[]) : [];
    cloudState.sports = resolvedSports;
    cloudState.settings = {
      targetPFC: settingsFromCloud?.targetPFC ?? DEFAULT_TARGET,
      profile: settingsFromCloud?.profile,
      favoriteFoodIds: Array.isArray(settingsFromCloud?.favoriteFoodIds)
        ? (settingsFromCloud.favoriteFoodIds as string[])
        : [],
      sports: resolvedSports,
    };
    cloudState.loaded = true;

    refreshUI();
    return true;
  } catch (error) {
    console.error('ユーザーデータ読み込み失敗', error);
    toast.error(
      error instanceof Error ? error.message : 'ユーザーデータ取得に失敗しました',
    );
    return false;
  }
}

export function isCloudDataLoaded(): boolean {
  return cloudState.loaded;
}

export function getTodayString(): string {
  return formatDate(new Date());
}

export function getLogs(): Record<string, DailyLog> {
  return cloudState.logs;
}

export function getLogForDate(date: string): DailyLog {
  const logs = getLogs();
  return (
    logs[date] || {
      date,
      items: [],
      activities: [],
      total: { protein: 0, fat: 0, carbs: 0, calories: 0 },
    }
  );
}

export function getTodayLog(): DailyLog {
  return getLogForDate(getTodayString());
}

export function saveLog(log: DailyLog) {
  cloudState.logs = { ...cloudState.logs, [log.date]: log };
  refreshUI();
  void syncResource('logs');
}

export function getAdjustedCalorieTarget(date: string): number {
  const settings = getSettings();
  const log = getLogForDate(date);
  const activityCalories = (log.activities || []).reduce(
    (total, activity) => total + activity.caloriesBurned,
    0,
  );

  return Math.max(0, settings.targetPFC.calories + activityCalories);
}

export function addSportDefinition(sport: SportDefinition) {
  const settings = getSettings();
  const sports = [...(settings.sports || [])];
  const normalized = toSportDefinition(sport);

  if (sports.some((item) => item.id === normalized.id)) return;

  sports.push(normalized);
  saveSettings({ ...settings, sports });
}

export function updateSportDefinition(updatedSport: SportDefinition) {
  const settings = getSettings();
  const sports = [...(settings.sports || [])];
  const index = sports.findIndex((item) => item.id === updatedSport.id);
  if (index === -1) return;

  sports[index] = toSportDefinition(updatedSport);
  saveSettings({ ...settings, sports });
}

export function deleteSportDefinition(id: string) {
  const settings = getSettings();
  const sports = (settings.sports || []).filter((sport) => sport.id !== id);
  saveSettings({ ...settings, sports });

  const logs = cloudState.logs;
  let changed = false;
  const nextLogs: Record<string, DailyLog> = {};

  Object.entries(logs).forEach(([date, log]) => {
    if (!log.activities?.length) {
      nextLogs[date] = log;
      return;
    }

    const nextActivities = log.activities.filter((activity) => activity.id !== id);
    if (nextActivities.length !== log.activities.length) {
      nextLogs[date] = { ...log, activities: nextActivities };
      changed = true;
    } else {
      nextLogs[date] = log;
    }
  });

  if (changed) {
    cloudState.logs = nextLogs;
    refreshUI();
    void syncResource('logs');
  }
}

export function addSportActivity(date: string, sport: SportDefinition) {
  const log = getLogForDate(date);
  const activities = log.activities || [];
  const activity: SportActivityLog = {
    ...toSportDefinition(sport),
    timestamp: Date.now(),
  };

  saveLog({ ...log, activities: [...activities, activity] });
}

export function deleteSportActivity(date: string, timestamp: number) {
  const log = getLogForDate(date);
  if (!log.activities?.length) return;

  saveLog({
    ...log,
    activities: log.activities.filter((activity) => activity.timestamp !== timestamp),
  });
}

export function getWeeklyLog(): {
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
  daysCount: number;
} {
  const logs = getLogs();
  const today = new Date();
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let totalCalories = 0;
  let daysCount = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);

    const log = logs[dateStr];
    if (log && log.total) {
      totalProtein += log.total.protein;
      totalFat += log.total.fat;
      totalCarbs += log.total.carbs;
      totalCalories += log.total.calories;
      daysCount++;
    }
  }

  return {
    protein: daysCount > 0 ? roundPFC(totalProtein / 7) : 0,
    fat: daysCount > 0 ? roundPFC(totalFat / 7) : 0,
    carbs: daysCount > 0 ? roundPFC(totalCarbs / 7) : 0,
    calories: daysCount > 0 ? roundPFC(totalCalories / 7) : 0,
    daysCount,
  };
}

export function getBalancedWeeklyTargets(): {
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
  remainingDays: number;
} {
  const settings = getSettings();
  const target = settings.targetPFC;
  const logs = getLogs();
  const today = new Date();

  const dayOfWeek = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dayOfWeek);

  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let totalCalories = 0;

  for (let i = 0; i < dayOfWeek; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const dateStr = formatDate(d);
    const log = logs[dateStr];
    if (log && log.total) {
      totalProtein += log.total.protein;
      totalFat += log.total.fat;
      totalCarbs += log.total.carbs;
      totalCalories += log.total.calories;
    }
  }

  const remainingDays = 7 - dayOfWeek;
  const weeklyTarget = {
    protein: target.protein * 7,
    fat: target.fat * 7,
    carbs: target.carbs * 7,
    calories: target.calories * 7,
  };

  const getBalanced = (weekly: number, consumed: number, dailyBase: number) => {
    const remaining = Math.max(0, weekly - consumed);
    const balanced = roundPFC(remaining / remainingDays);
    return Math.min(dailyBase, balanced);
  };

  return {
    protein: getBalanced(weeklyTarget.protein, totalProtein, target.protein),
    fat: getBalanced(weeklyTarget.fat, totalFat, target.fat),
    carbs: getBalanced(weeklyTarget.carbs, totalCarbs, target.carbs),
    calories: getBalanced(
      weeklyTarget.calories,
      totalCalories,
      target.calories,
    ),
    remainingDays,
  };
}

export function getPfcDebt(currentDate: string): PFC {
  const settings = getSettings();
  const target = settings.targetPFC;
  const logs = getLogs();

  const sortedDates = getSortedLogDates(logs, 'asc');
  const cumulativeDebt: PFC = { ...emptyTotals };

  const toDateStr = (d: Date) => formatDate(d);

  if (sortedDates.length === 0) return cumulativeDebt;

  const firstLogDate = sortedDates[0];
  const firstDate = new Date(firstLogDate);

  const targetProtein = target.protein;
  const targetFat = target.fat;
  const targetCarbs = target.carbs;
  const targetCalories = target.calories;

  const d = new Date(firstDate);
  let dateStr = toDateStr(d);
  while (dateStr < currentDate) {
    const log = logs[dateStr];

    const dailyExcess =
      log && log.total
        ? {
            protein: log.total.protein - targetProtein,
            fat: log.total.fat - targetFat,
            carbs: log.total.carbs - targetCarbs,
            calories: log.total.calories - targetCalories,
          }
        : emptyTotals;

    cumulativeDebt.protein = Math.max(
      0,
      cumulativeDebt.protein + dailyExcess.protein,
    );
    cumulativeDebt.fat = Math.max(0, cumulativeDebt.fat + dailyExcess.fat);
    cumulativeDebt.carbs = Math.max(
      0,
      cumulativeDebt.carbs + dailyExcess.carbs,
    );
    cumulativeDebt.calories = Math.max(
      0,
      cumulativeDebt.calories + dailyExcess.calories,
    );

    d.setDate(d.getDate() + 1);
    dateStr = toDateStr(d);
  }

  return {
    protein: roundPFC(cumulativeDebt.protein),
    fat: roundPFC(cumulativeDebt.fat),
    carbs: roundPFC(cumulativeDebt.carbs),
    calories: roundPFC(cumulativeDebt.calories),
  };
}

export function recalculateLogTotals(log: DailyLog): DailyLog {
  const totals = log.items.reduce(
    (acc, curr) => ({
      protein: acc.protein + curr.protein,
      fat: acc.fat + curr.fat,
      carbs: acc.carbs + curr.carbs,
      calories: acc.calories + curr.calories,
    }),
    emptyTotals,
  );

  log.total = {
    protein: roundPFC(totals.protein),
    fat: roundPFC(totals.fat),
    carbs: roundPFC(totals.carbs),
    calories: roundPFC(totals.calories),
  };

  return log;
}

export function addFoodItem(item: FoodItem) {
  const date = getDateFromTimestamp(item.timestamp);

  const existing = getLogForDate(date);
  const nextLog: DailyLog = {
    ...existing,
    items: [...existing.items, item],
    activities: existing.activities ?? [],
  };

  recalculateLogTotals(nextLog);
  saveLog(nextLog);
}

export function deleteLogItem(id: string, timestamp: number) {
  const date = getDateFromTimestamp(timestamp);

  const existing = getLogForDate(date);
  const nextLog: DailyLog = {
    ...existing,
    items: existing.items.filter((item) => item.id !== id),
  };

  recalculateLogTotals(nextLog);
  saveLog(nextLog);
}

export function updateLogItem(oldTimestamp: number, newItem: FoodItem) {
  const oldDate = getDateFromTimestamp(oldTimestamp);
  const newDate = getDateFromTimestamp(newItem.timestamp);

  if (oldDate === newDate) {
    const existing = getLogForDate(oldDate);
    const index = existing.items.findIndex((item) => item.id === newItem.id);
    if (index === -1) return;

    const nextItems = [...existing.items];
    nextItems[index] = newItem;
    const nextLog: DailyLog = { ...existing, items: nextItems };
    recalculateLogTotals(nextLog);
    saveLog(nextLog);
  } else {
    deleteLogItem(newItem.id, oldTimestamp);
    addFoodItem(newItem);
  }
}

export function getSettings(): UserSettings {
  const savedSports = normalizeSports(cloudState.sports);
  const fallbackSports = normalizeSports(cloudState.settings.sports);
  const sports =
    savedSports.length > 0
      ? savedSports
      : fallbackSports.length > 0
        ? fallbackSports
        : getDefaultSports();

  return {
    ...cloudState.settings,
    sports,
  };
}

export function saveSettings(settings: UserSettings) {
  const normalizedSports = normalizeSports(settings.sports);

  cloudState.settings = {
    ...settings,
    sports: normalizedSports,
  };
  cloudState.sports = normalizedSports;
  refreshUI();
  void syncResource('settings');
  void syncResource('sports');
}

import generatedFoodsRaw from '@/data/generated_foods.json';
const generatedFoods = generatedFoodsRaw as FoodItem[];

export function getFoodDictionary(): FoodItem[] {
  if (!isClient) return [];

  const merged = [...cloudState.foods];
  let changed = false;

  generatedFoods.forEach((defaultItem) => {
    const exists = merged.some((item) => item.id === defaultItem.id);
    if (!exists) {
      merged.push(defaultItem);
      changed = true;
    }
  });

  if (changed) {
    saveFoodDictionary(merged);
  }

  return merged;
}

export function saveFoodDictionary(foods: FoodItem[]) {
  cloudState.foods = foods;
  refreshUI();
  void syncResource('foods');
}

export function addFoodToDictionary(item: FoodItem) {
  saveFoodDictionary([...cloudState.foods, item]);
}

export function updateFoodInDictionary(updatedItem: FoodItem) {
  const index = cloudState.foods.findIndex((f) => f.id === updatedItem.id);
  if (index === -1) return;

  const next = [...cloudState.foods];
  next[index] = updatedItem;
  saveFoodDictionary(next);
}

export function deleteFoodFromDictionary(id: string) {
  saveFoodDictionary(cloudState.foods.filter((f) => f.id !== id));
}

export function getHistoryItems(): FoodItem[] {
  const logs = getLogs();
  const allItems: FoodItem[] = [];
  const seenNames = new Set<string>();

  const sortedDates = getSortedLogDates(logs);

  for (const date of sortedDates) {
    const dayLog = logs[date];
    for (let i = dayLog.items.length - 1; i >= 0; i--) {
      const item = dayLog.items[i];
      const key = `${item.name}-${item.calories}`;
      if (!seenNames.has(key)) {
        seenNames.add(key);
        allItems.push(item);
      }
    }
  }

  return allItems;
}

export function getAllLogItems(): FoodItem[] {
  const logs = getLogs();
  const allItems: FoodItem[] = [];

  const sortedDates = getSortedLogDates(logs);

  for (const date of sortedDates) {
    const dayLog = logs[date];
    const sortedDayItems = [...dayLog.items].sort(
      (a, b) => b.timestamp - a.timestamp,
    );
    allItems.push(...sortedDayItems);
  }

  return allItems;
}

export function getUniqueStores(): string[] {
  const dictionary = getFoodDictionary();
  const history = getHistoryItems();
  const stores = new Set<string>();
  [...dictionary, ...history].forEach((item) => {
    if (item.store) {
      stores.add(item.store);
    }
  });

  return Array.from(stores).sort();
}

const getFavoriteFoodIds = (settings: UserSettings): string[] =>
  Array.isArray(settings.favoriteFoodIds) ? [...settings.favoriteFoodIds] : [];

export function getFavoriteFoods(): FoodItem[] {
  const settings = getSettings();
  const favoriteIds = getFavoriteFoodIds(settings);

  if (favoriteIds.length === 0) return [];

  const dictionary = getFoodDictionary();
  return favoriteIds
    .map((id) => dictionary.find((item) => item.id === id))
    .filter((item): item is FoodItem => item !== undefined);
}

export function toggleFavoriteFood(id: string) {
  const settings = getSettings();
  const favoriteIds = getFavoriteFoodIds(settings);

  const index = favoriteIds.indexOf(id);
  if (index === -1) {
    favoriteIds.push(id);
  } else {
    favoriteIds.splice(index, 1);
  }

  saveSettings({ ...settings, favoriteFoodIds: favoriteIds });
}

export function isFavoriteFood(id: string): boolean {
  const settings = getSettings();
  const favoriteIds = getFavoriteFoodIds(settings);
  return favoriteIds.includes(id);
}
