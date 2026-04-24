'use client';

import { DailyLog, FoodItem, PFC } from '../types';
import { formatDate, roundPFC } from '../utils';
import { cloudState, refreshUI, syncResource } from './state';
import { getSettings } from './settings';

const emptyTotals: PFC = { protein: 0, fat: 0, carbs: 0, calories: 0 };

const getDateFromTimestamp = (timestamp: number) => formatDate(new Date(timestamp));

const getSortedLogDates = (
  logs: Record<string, DailyLog>,
  order: 'asc' | 'desc' = 'desc',
) =>
  Object.keys(logs).sort((a, b) =>
    order === 'asc' ? a.localeCompare(b) : b.localeCompare(a),
  );

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

  if (sortedDates.length === 0) return cumulativeDebt;

  const firstLogDate = sortedDates[0];
  const firstDate = new Date(firstLogDate);

  const targetProtein = target.protein;
  const targetFat = target.fat;
  const targetCarbs = target.carbs;
  const targetCalories = target.calories;

  const d = new Date(firstDate);
  let dateStr = formatDate(d);
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
    dateStr = formatDate(d);
  }

  return {
    protein: roundPFC(cumulativeDebt.protein),
    fat: roundPFC(cumulativeDebt.fat),
    carbs: roundPFC(cumulativeDebt.carbs),
    calories: roundPFC(cumulativeDebt.calories),
  };
}
