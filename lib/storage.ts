'use client';

import { DailyLog, FoodItem, UserSettings, DEFAULT_TARGET } from './types';

const STORAGE_KEY_LOGS = 'pfc_logs';
const STORAGE_KEY_SETTINGS = 'pfc_settings';

// Helper to get today's date string YYYY-MM-DD in local time
export function getTodayString(): string {
  const dateObj = new Date();
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLogs(): Record<string, DailyLog> {
  if (typeof window === 'undefined') return {};
  const stored = localStorage.getItem(STORAGE_KEY_LOGS);
  return stored ? JSON.parse(stored) : {};
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

export function saveLog(log: DailyLog) {
  const logs = getLogs();
  logs[log.date] = log;
  localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
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
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

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
    protein: daysCount > 0 ? Math.round(totalProtein / 7) : 0,
    fat: daysCount > 0 ? Math.round(totalFat / 7) : 0,
    carbs: daysCount > 0 ? Math.round(totalCarbs / 7) : 0,
    calories: daysCount > 0 ? Math.round(totalCalories / 7) : 0,
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
    const dateStr = d.toISOString().split('T')[0];
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
    const balanced = Math.round(remaining / remainingDays);
    return Math.min(dailyBase, balanced);
  };

  return {
    protein: getBalanced(weeklyTarget.protein, totalProtein, target.protein),
    fat: getBalanced(weeklyTarget.fat, totalFat, target.fat),
    carbs: getBalanced(weeklyTarget.carbs, totalCarbs, target.carbs),
    calories: getBalanced(weeklyTarget.calories, totalCalories, target.calories),
    remainingDays,
  };
}
export function recalculateLogTotals(log: DailyLog): DailyLog {
  log.total = log.items.reduce(
    (acc, curr) => ({
      protein: acc.protein + curr.protein,
      fat: acc.fat + curr.fat,
      carbs: acc.carbs + curr.carbs,
      calories: acc.calories + curr.calories,
    }),
    { protein: 0, fat: 0, carbs: 0, calories: 0 },
  );
  return log;
}

export function addFoodItem(item: FoodItem) {
  // Extract date (YYYY-MM-DD) from timestamp
  // Use local time for date string
  const dateObj = new Date(item.timestamp);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const date = `${year}-${month}-${day}`;

  const log = getLogForDate(date);
  log.items.push(item);

  recalculateLogTotals(log);
  saveLog(log);
}

export function deleteLogItem(id: string, timestamp: number) {
  const dateObj = new Date(timestamp);
  const date = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

  const log = getLogForDate(date);
  log.items = log.items.filter(item => item.id !== id);

  recalculateLogTotals(log);
  saveLog(log);
}

export function updateLogItem(oldTimestamp: number, newItem: FoodItem) {
  const oldDateObj = new Date(oldTimestamp);
  const oldDate = `${oldDateObj.getFullYear()}-${String(oldDateObj.getMonth() + 1).padStart(2, '0')}-${String(oldDateObj.getDate()).padStart(2, '0')}`;

  const newDateObj = new Date(newItem.timestamp);
  const newDate = `${newDateObj.getFullYear()}-${String(newDateObj.getMonth() + 1).padStart(2, '0')}-${String(newDateObj.getDate()).padStart(2, '0')}`;

  if (oldDate === newDate) {
    const log = getLogForDate(oldDate);
    const index = log.items.findIndex(item => item.id === newItem.id);
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
  if (typeof window === 'undefined') return { targetPFC: DEFAULT_TARGET };
  const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
  return stored ? JSON.parse(stored) : { targetPFC: DEFAULT_TARGET };
}

export function saveSettings(settings: UserSettings) {
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

// --- Food Dictionary Management ---

const STORAGE_KEY_FOODS = 'pfc_food_dictionary';
import publicFoods from '@/data/public_foods.json';

export function getFoodDictionary(): FoodItem[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY_FOODS);
  if (stored) {
    return JSON.parse(stored);
  }
  // Initialize with public foods if empty
  const defaults = publicFoods as FoodItem[];
  saveFoodDictionary(defaults);
  return defaults;
}

export function saveFoodDictionary(foods: FoodItem[]) {
  localStorage.setItem(STORAGE_KEY_FOODS, JSON.stringify(foods));
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
  const sortedDates = Object.keys(logs).sort().reverse();

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
  const sortedDates = Object.keys(logs).sort().reverse();

  for (const date of sortedDates) {
    const dayLog = logs[date];
    // Sort items within the day by timestamp desc
    const sortedDayItems = [...dayLog.items].sort((a, b) => b.timestamp - a.timestamp);
    allItems.push(...sortedDayItems);
  }

  return allItems;
}
