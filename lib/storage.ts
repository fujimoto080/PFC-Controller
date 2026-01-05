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

  // Recalculate totals
  log.total = log.items.reduce(
    (acc, curr) => ({
      protein: acc.protein + curr.protein,
      fat: acc.fat + curr.fat,
      carbs: acc.carbs + curr.carbs,
      calories: acc.calories + curr.calories,
    }),
    { protein: 0, fat: 0, carbs: 0, calories: 0 },
  );

  saveLog(log);
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
