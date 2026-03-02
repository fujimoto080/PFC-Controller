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
import { BackupPayload, isBackupPayload } from './backup';

const STORAGE_KEY_LOGS = 'pfc_logs';
const STORAGE_KEY_SETTINGS = 'pfc_settings';
const STORAGE_KEY_FOODS = 'pfc_food_dictionary';
const STORAGE_KEY_SPORTS = 'pfc_sports';
const STORAGE_KEY_CLOUD_MIGRATED_PREFIX = 'pfc_cloud_migrated_v1';

const STORAGE_KEYS = {
  logs: STORAGE_KEY_LOGS,
  settings: STORAGE_KEY_SETTINGS,
  foods: STORAGE_KEY_FOODS,
  sports: STORAGE_KEY_SPORTS,
} as const;

const isClient = typeof window !== 'undefined';

const emptyTotals: PFC = { protein: 0, fat: 0, carbs: 0, calories: 0 };

let hasInitializedCloudSync = false;
let initializedSyncKey = '';
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isApplyingCloudData = false;
let cloudUpdatedAt = 0;

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

const normalizeSyncKey = (value: string | undefined): string =>
  (value || '').trim();

const getCloudSyncKey = (): string => {
  const settings = getStorageItem<UserSettings>(STORAGE_KEYS.settings, {
    targetPFC: DEFAULT_TARGET,
  });
  return normalizeSyncKey(settings.cloudSyncKey);
};

const getMigrationFlagKey = (syncKey: string): string =>
  `${STORAGE_KEY_CLOUD_MIGRATED_PREFIX}:${syncKey}`;

const hasMigratedForSyncKey = (syncKey: string): boolean =>
  localStorage.getItem(getMigrationFlagKey(syncKey)) === '1';

const setStorageItem = <T>(key: string, value: T) => {
  if (!isClient) return;
  localStorage.setItem(key, JSON.stringify(value));
  scheduleCloudSync();
};

const getLocalBackupPayload = (): BackupPayload => ({
  version: 1,
  createdAt: Date.now(),
  logs: getStorageItem<Record<string, DailyLog>>(STORAGE_KEYS.logs, {}),
  settings: getStorageItem<Record<string, unknown>>(STORAGE_KEYS.settings, {
    targetPFC: DEFAULT_TARGET,
  } as unknown as Record<string, unknown>),
  foods: getStorageItem<unknown[]>(STORAGE_KEYS.foods, []),
  sports: getStorageItem<unknown[]>(STORAGE_KEYS.sports, []),
});

const applyPayloadToLocalStorage = (payload: BackupPayload) => {
  isApplyingCloudData = true;
  localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(payload.logs));
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(payload.settings));
  localStorage.setItem(STORAGE_KEYS.foods, JSON.stringify(payload.foods));
  localStorage.setItem(
    STORAGE_KEYS.sports,
    JSON.stringify(normalizeSports(payload.sports || [])),
  );
  isApplyingCloudData = false;
};

const pushLocalDataToCloud = async (reason: string) => {
  if (!isClient || isApplyingCloudData) return;

  const syncKey = getCloudSyncKey();
  if (!syncKey) return;

  const payload = getLocalBackupPayload();

  try {
    const response = await fetch('/api/cloud-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, reason, updatedAt: Date.now(), syncKey }),
    });

    if (!response.ok) return;

    const result = (await response.json()) as { updatedAt?: unknown };
    if (typeof result.updatedAt === 'number' && Number.isFinite(result.updatedAt)) {
      cloudUpdatedAt = result.updatedAt;
    }
  } catch (error) {
    console.error('クラウド同期エラー', error);
  }
};

const scheduleCloudSync = () => {
  if (!isClient || isApplyingCloudData) return;

  const syncKey = getCloudSyncKey();
  if (!syncKey) return;

  if (!hasMigratedForSyncKey(syncKey)) return;

  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(() => {
    syncTimer = null;
    void pushLocalDataToCloud('auto-sync');
  }, 300);
};

const initializeCloudSync = async () => {
  if (!isClient) return;

  const syncKey = getCloudSyncKey();
  if (!syncKey) return;
  if (hasInitializedCloudSync && initializedSyncKey === syncKey) return;

  hasInitializedCloudSync = true;
  initializedSyncKey = syncKey;

  try {
    const response = await fetch(`/api/cloud-data?syncKey=${encodeURIComponent(syncKey)}`, {
      cache: 'no-store',
    });
    if (!response.ok) return;

    const result = (await response.json()) as {
      payload?: unknown;
      updatedAt?: unknown;
    };

    const cloudPayload = isBackupPayload(result.payload) ? result.payload : null;
    const remoteUpdatedAt =
      typeof result.updatedAt === 'number' && Number.isFinite(result.updatedAt)
        ? result.updatedAt
        : 0;

    const migrationFlagKey = getMigrationFlagKey(syncKey);
    const hasMigrated = localStorage.getItem(migrationFlagKey) === '1';

    if (!hasMigrated) {
      const hasLocalData =
        localStorage.getItem(STORAGE_KEYS.logs) !== null ||
        localStorage.getItem(STORAGE_KEYS.settings) !== null ||
        localStorage.getItem(STORAGE_KEYS.foods) !== null ||
        localStorage.getItem(STORAGE_KEYS.sports) !== null;

      if (hasLocalData && !cloudPayload) {
        await pushLocalDataToCloud('initial-migration');
      } else if (cloudPayload) {
        applyPayloadToLocalStorage(cloudPayload);
        cloudUpdatedAt = remoteUpdatedAt;
        refreshUI();
      }

      localStorage.setItem(migrationFlagKey, '1');
      return;
    }

    if (!cloudPayload) return;

    if (remoteUpdatedAt > cloudUpdatedAt) {
      applyPayloadToLocalStorage(cloudPayload);
      cloudUpdatedAt = remoteUpdatedAt;
      refreshUI();
    }
  } catch (error) {
    hasInitializedCloudSync = false;
    console.error('クラウド初期化エラー', error);
  }
};

if (isClient) {
  void initializeCloudSync();
}

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
      activities: [],
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

const toSportDefinition = (sport: SportDefinition): SportDefinition => ({
  id: sport.id,
  name: sport.name,
  caloriesBurned: Math.max(0, roundPFC(sport.caloriesBurned)),
});

const getDefaultSports = (): SportDefinition[] => [
  { id: 'walking', name: 'ウォーキング', caloriesBurned: 180 },
  { id: 'running', name: 'ランニング', caloriesBurned: 320 },
  { id: 'cycling', name: 'サイクリング', caloriesBurned: 260 },
];

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

export function saveLog(log: DailyLog) {
  const logs = getLogs();
  logs[log.date] = log;
  setStorageItem(STORAGE_KEYS.logs, logs);
  refreshUI();
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

  const logs = getLogs();
  let changed = false;

  Object.values(logs).forEach((log) => {
    if (!log.activities?.length) return;

    const nextActivities = log.activities.filter((activity) => activity.id !== id);
    if (nextActivities.length !== log.activities.length) {
      log.activities = nextActivities;
      changed = true;
    }
  });

  if (changed) {
    setStorageItem(STORAGE_KEYS.logs, logs);
    refreshUI();
  }
}

export function addSportActivity(date: string, sport: SportDefinition) {
  const log = getLogForDate(date);
  const activities = log.activities || [];
  const activity: SportActivityLog = {
    ...toSportDefinition(sport),
    timestamp: Date.now(),
  };

  log.activities = [...activities, activity];
  saveLog(log);
}

export function deleteSportActivity(date: string, timestamp: number) {
  const log = getLogForDate(date);
  if (!log.activities?.length) return;

  log.activities = log.activities.filter((activity) => activity.timestamp !== timestamp);
  saveLog(log);
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
    deleteLogItem(newItem.id, oldTimestamp);
    addFoodItem(newItem);
  }
}

export function getSettings(): UserSettings {
  const settings = getStorageItem<UserSettings>(STORAGE_KEYS.settings, {
    targetPFC: DEFAULT_TARGET,
  });

  const savedSports = normalizeSports(
    getStorageItem<unknown[]>(STORAGE_KEYS.sports, []),
  );
  const fallbackSports = normalizeSports(settings.sports);
  const sports =
    savedSports.length > 0
      ? savedSports
      : fallbackSports.length > 0
        ? fallbackSports
        : getDefaultSports();

  return {
    ...settings,
    sports,
  };
}

export function saveSettings(settings: UserSettings) {
  const normalizedSports = normalizeSports(settings.sports);
  setStorageItem(STORAGE_KEYS.settings, {
    ...settings,
    sports: normalizedSports,
  });
  setStorageItem(STORAGE_KEYS.sports, normalizedSports);
  refreshUI();
  void initializeCloudSync();
}

import generatedFoodsRaw from '@/data/generated_foods.json';
const generatedFoods = generatedFoodsRaw as FoodItem[];

export function getFoodDictionary(): FoodItem[] {
  if (!isClient) return [];
  const userFoods = getStorageItem<FoodItem[]>(STORAGE_KEYS.foods, []);

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
    sports: getStorageItem<unknown[]>(STORAGE_KEYS.sports, []),
  };
}

export function restoreBackupPayload(payload: unknown): boolean {
  if (!isBackupPayload(payload)) return false;

  setStorageItem(STORAGE_KEYS.logs, payload.logs);
  setStorageItem(STORAGE_KEYS.settings, payload.settings);
  setStorageItem(STORAGE_KEYS.foods, payload.foods);
  setStorageItem(STORAGE_KEYS.sports, normalizeSports(payload.sports || []));
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

  dictionary.forEach((item) => {
    if (item.store) stores.add(item.store);
  });

  history.forEach((item) => {
    if (item.store) stores.add(item.store);
  });

  return Array.from(stores).sort();
}

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
    favoriteIds.push(id);
  } else {
    favoriteIds.splice(index, 1);
  }

  saveSettings({ ...settings, favoriteFoodIds: favoriteIds });
}

export function isFavoriteFood(id: string): boolean {
  const settings = getSettings();
  const favoriteIds = settings.favoriteFoodIds || [];
  return favoriteIds.includes(id);
}
