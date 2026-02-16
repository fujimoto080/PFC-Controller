'use client';

import { DailyLog, FoodItem, UserSettings, DEFAULT_TARGET, PFC } from './types';
import { formatDate, roundPFC } from './utils';
import { BackupPayload, isBackupPayload } from './backup';

const STORAGE_KEY_LOGS = 'pfc_logs';
const STORAGE_KEY_SETTINGS = 'pfc_settings';
const STORAGE_KEY_FOODS = 'pfc_food_dictionary';

const STORAGE_KEYS = {
  logs: STORAGE_KEY_LOGS,
  settings: STORAGE_KEY_SETTINGS,
  foods: STORAGE_KEY_FOODS,
} as const;

const isClient = typeof window !== 'undefined';

const emptyTotals: PFC = { protein: 0, fat: 0, carbs: 0, calories: 0 };

const getDateFromTimestamp = (timestamp: number) =>
  formatDate(new Date(timestamp));

const getSortedLogDates = (
  logs: Record<string, DailyLog>,
  order: 'asc' | 'desc' = 'desc',
) =>
  Object.keys(logs).sort((a, b) =>
    order === 'asc' ? a.localeCompare(b) : b.localeCompare(a),
  );

const getStorageItem = <T>(key: string, fallback: T): T => {
  if (!isClient) return fallback;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : fallback;
};

const setStorageItem = <T>(key: string, value: T) => {
  if (!isClient) return;
  localStorage.setItem(key, JSON.stringify(value));
};

// Helper to get today's date string YYYY-MM-DD in local time
export function getTodayString(): string {
  return formatDate(new Date());
}

export function getLogs(): Record<string, DailyLog> {
  return getStorageItem<Record<string, DailyLog>>(STORAGE_KEYS.logs, {});
}

export function getLogForDate(date: string): DailyLog {
  const logs = getLogs();
  return (
    logs[date] || {
      date,
      items: [],
      total: { protein: 0, fat: 0, carbs: 0, calories: 0 },
    }
  );
}

export function getTodayLog(): DailyLog {
  return getLogForDate(getTodayString());
}

export function refreshUI() {
  if (isClient) {
    window.dispatchEvent(new Event('pfc-update'));
  }
}

export function saveLog(log: DailyLog) {
  const logs = getLogs();
  logs[log.date] = log;
  setStorageItem(STORAGE_KEYS.logs, logs);
  refreshUI();
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

  // Find the most recent Sunday
  const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dayOfWeek);

  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let totalCalories = 0;

  // Aggregate stats from Sunday up to yesterday
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

  // Sort dates chronological to calculate cumulative debt
  const sortedDates = getSortedLogDates(logs, 'asc');
  const cumulativeDebt: PFC = { ...emptyTotals };

  // Helper to get local date string for any Date object
  const toDateStr = (d: Date) => formatDate(d);

  // If there are no logs at all, return zero debt
  if (sortedDates.length === 0) return cumulativeDebt;

  const firstLogDate = sortedDates[0];
  const firstDate = new Date(firstLogDate);

  // Iterate from the very first log date up to the day before currentDate
  // Use a cache for target values to avoid repeated function calls
  const targetProtein = target.protein;
  const targetFat = target.fat;
  const targetCarbs = target.carbs;
  const targetCalories = target.calories;

  const d = new Date(firstDate);
  let dateStr = toDateStr(d);
  while (dateStr < currentDate) {
    const log = logs[dateStr];

    // Calculate daily balance (surplus/deficit relative to target)
    // Positive result means excess (debt)
    // Negative result means under target (repayment)
    const dailyExcess =
      log && log.total
        ? {
            protein: log.total.protein - targetProtein,
            fat: log.total.fat - targetFat,
            carbs: log.total.carbs - targetCarbs,
            calories: log.total.calories - targetCalories,
          }
        : emptyTotals;

    // Add to cumulative debt, but cap debt at zero
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
  // Extract date (YYYY-MM-DD) from timestamp
  // Use local time for date string
  const date = getDateFromTimestamp(item.timestamp);

  const log = getLogForDate(date);
  log.items.push(item);

  recalculateLogTotals(log);
  saveLog(log);
}

export function deleteLogItem(id: string, timestamp: number) {
  const date = getDateFromTimestamp(timestamp);

  const log = getLogForDate(date);
  log.items = log.items.filter((item) => item.id !== id);

  recalculateLogTotals(log);
  saveLog(log);
}

export function updateLogItem(oldTimestamp: number, newItem: FoodItem) {
  const oldDate = getDateFromTimestamp(oldTimestamp);
  const newDate = getDateFromTimestamp(newItem.timestamp);

  if (oldDate === newDate) {
    const log = getLogForDate(oldDate);
    const index = log.items.findIndex((item) => item.id === newItem.id);
    if (index !== -1) {
      log.items[index] = newItem;
      recalculateLogTotals(log);
      saveLog(log);
    }
  } else {
    // Moved to another day
    deleteLogItem(newItem.id, oldTimestamp);
    addFoodItem(newItem);
  }
}

export function getSettings(): UserSettings {
  return getStorageItem<UserSettings>(STORAGE_KEYS.settings, {
    targetPFC: DEFAULT_TARGET,
  });
}

export function saveSettings(settings: UserSettings) {
  setStorageItem(STORAGE_KEYS.settings, settings);
  refreshUI();
}

// --- Food Dictionary Management ---

import generatedFoodsRaw from '@/data/generated_foods.json';
const generatedFoods = generatedFoodsRaw as FoodItem[];

export function getFoodDictionary(): FoodItem[] {
  if (!isClient) return [];
  const userFoods = getStorageItem<FoodItem[]>(STORAGE_KEYS.foods, []);

  // Merge system foods (defaults) into user foods if they don't exist
  const merged = [...userFoods];
  let changed = false;

  generatedFoods.forEach((defaultItem) => {
    const exists = merged.some((item) => item.id === defaultItem.id);
    if (!exists) {
      merged.push(defaultItem);
      changed = true;
    }
  });

  if (changed || userFoods.length === 0) {
    saveFoodDictionary(merged);
  }

  return merged;
}

export function saveFoodDictionary(foods: FoodItem[]) {
  setStorageItem(STORAGE_KEYS.foods, foods);
  refreshUI();
}

export function createBackupPayload(): BackupPayload {
  return {
    version: 1,
    createdAt: Date.now(),
    logs: getStorageItem<Record<string, DailyLog>>(STORAGE_KEYS.logs, {}),
    settings: getStorageItem<Record<string, unknown>>(STORAGE_KEYS.settings, {
      targetPFC: DEFAULT_TARGET,
    } as unknown as Record<string, unknown>),
    foods: getStorageItem<unknown[]>(STORAGE_KEYS.foods, []),
  };
}

export function restoreBackupPayload(payload: unknown): boolean {
  if (!isBackupPayload(payload)) return false;

  setStorageItem(STORAGE_KEYS.logs, payload.logs);
  setStorageItem(STORAGE_KEYS.settings, payload.settings);
  setStorageItem(STORAGE_KEYS.foods, payload.foods);
  refreshUI();

  return true;
}

export function addFoodToDictionary(item: FoodItem) {
  const foods = getFoodDictionary();
  foods.push(item);
  saveFoodDictionary(foods);
}

export function updateFoodInDictionary(updatedItem: FoodItem) {
  const foods = getFoodDictionary();
  const index = foods.findIndex((f) => f.id === updatedItem.id);
  if (index !== -1) {
    foods[index] = updatedItem;
    saveFoodDictionary(foods);
  }
}

export function deleteFoodFromDictionary(id: string) {
  const foods = getFoodDictionary();
  const filtered = foods.filter((f) => f.id !== id);
  saveFoodDictionary(filtered);
}

export function getHistoryItems(): FoodItem[] {
  const logs = getLogs();
  const allItems: FoodItem[] = [];
  const seenNames = new Set<string>();

  // Iterate over all logs in reverse chronological order (if keys are dates, sort them)
  const sortedDates = getSortedLogDates(logs);

  for (const date of sortedDates) {
    const dayLog = logs[date];
    // Traverse items in reverse (newest first)
    for (let i = dayLog.items.length - 1; i >= 0; i--) {
      const item = dayLog.items[i];
      // Key by name + calories (rough uniqueness)
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

  // Sort dates in reverse chronological order
  const sortedDates = getSortedLogDates(logs);

  for (const date of sortedDates) {
    const dayLog = logs[date];
    // Sort items within the day by timestamp desc
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

  dictionary.forEach((item) => {
    if (item.store) stores.add(item.store);
  });

  history.forEach((item) => {
    if (item.store) stores.add(item.store);
  });

  return Array.from(stores).sort();
}

// --- Favorite Foods Management ---

export function getFavoriteFoods(): FoodItem[] {
  const settings = getSettings();
  const favoriteIds = settings.favoriteFoodIds || [];

  if (favoriteIds.length === 0) return [];

  const dictionary = getFoodDictionary();
  return favoriteIds
    .map((id) => dictionary.find((item) => item.id === id))
    .filter((item): item is FoodItem => item !== undefined);
}

export function toggleFavoriteFood(id: string) {
  const settings = getSettings();
  const favoriteIds = settings.favoriteFoodIds || [];

  const index = favoriteIds.indexOf(id);
  if (index === -1) {
    // Add to favorites
    favoriteIds.push(id);
  } else {
    // Remove from favorites
    favoriteIds.splice(index, 1);
  }

  saveSettings({ ...settings, favoriteFoodIds: favoriteIds });
}

export function isFavoriteFood(id: string): boolean {
  const settings = getSettings();
  const favoriteIds = settings.favoriteFoodIds || [];
  return favoriteIds.includes(id);
}
