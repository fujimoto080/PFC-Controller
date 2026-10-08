import { PFC_KEYS, type PfcKey } from './macros';
import type { DailyLog, Logs, PFC, UserSettings } from './types';
import { roundPFC, shiftDate } from './utils';
import {
  calculateGoals,
  DEFAULT_PROFILE,
  targetDuration,
} from './nutrition-goals';

function mapPFC<T = number>(fn: (key: PfcKey) => T): Record<PfcKey, T> {
  return {
    protein: fn('protein'),
    fat: fn('fat'),
    carbs: fn('carbs'),
    calories: fn('calories'),
  };
}

/** PFC の合計を小数第2位で丸めて返す。 */
export function sumPFC(items: readonly PFC[]): PFC {
  return mapPFC((key) =>
    roundPFC(items.reduce((acc, item) => acc + item[key], 0)),
  );
}

/** a - b を小数第2位で丸めて返す（負にもなる）。 */
export function subtractPFC(a: PFC, b: PFC): PFC {
  return mapPFC((key) => roundPFC(a[key] - b[key]));
}

/** 栄養値を factor 倍する（数量 ×0.5 / ×2 などの記録用）。 */
export function scalePFC<T extends PFC>(food: T, factor: number): T {
  return { ...food, ...mapPFC((key) => roundPFC(food[key] * factor)) };
}

/** P/F/C/カロリーのどれかが 0 より大きい（全部 0 の読み取り結果は栄養値として意味がない）。 */
export function hasNutrition(pfc: PFC): boolean {
  return PFC_KEYS.some((key) => pfc[key] > 0);
}

/** その日の運動による消費カロリーの合計。 */
export function burnedCalories(log: DailyLog | undefined): number {
  return roundPFC(
    (log?.activities ?? []).reduce(
      (total, activity) => total + activity.caloriesBurned,
      0,
    ),
  );
}

/** 活動レベルに運動を含めるため、記録した消費量を目標に加算しない。 */
export interface DailyLimit {
  limit: PFC;
  target: PFC;
  burnedCalories: number;
  calorieRange: { min: number; max: number };
  fatRange: { min: number; max: number };
  adjustment: {
    calories: number;
    outstandingCalories: number;
    minimumCalories: number;
  };
  /** 前日までの7日間。記録した日の平均であり、未記録日は0として数えない。 */
  weekly: {
    recordedDays: number;
    average: PFC | null;
    calorieDifference: number | null;
  };
}

/** 超過は7日間で分散。不足を先取りの食事枠にはせず、実際に抑えた分だけ古い超過から相殺する。 */
function spreadCalorieExcess(
  date: string,
  logs: Logs,
  base: number,
  minimum: number,
) {
  let lots: { date: string; amount: number }[] = [];
  const active = (day: string) =>
    lots.filter((lot) => lot.date >= shiftDate(day, -7));
  for (const log of Object.values(logs)
    .filter((log) => log.date < date && log.items.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))) {
    lots = active(log.date);
    const difference = log.total.calories - base;
    // 極端に少ない記録は、記録漏れの可能性があるため相殺には使わない。
    if (difference < 0 && log.total.calories < minimum) continue;
    let rest = difference;
    for (const lot of lots) {
      if (rest * lot.amount >= 0) continue;
      const sign = Math.sign(rest);
      const used = Math.min(Math.abs(rest), Math.abs(lot.amount));
      lot.amount += sign * used;
      rest -= sign * used;
    }
    lots = lots.filter((lot) => lot.amount !== 0);
    if (rest !== 0) lots.push({ date: log.date, amount: rest });
  }
  // 不足は超過との相殺だけに使い、翌日の食事枠を増やさない。
  lots = active(date).filter((lot) => lot.amount > 0);
  return {
    outstanding: lots.reduce((sum, lot) => sum + lot.amount, 0),
    daily: lots.reduce((sum, lot) => {
      const age = (Date.parse(date) - Date.parse(lot.date)) / 86400000;
      return sum + lot.amount / (8 - age);
    }, 0),
  };
}

/** 保存済みの旧目標ではなく、現在のプロフィールから共通の基準を計算する。 */
export function computeDailyLimit(
  date: string,
  settings: Pick<UserSettings, 'profile'>,
  logs: Logs,
): DailyLimit {
  const profile = settings.profile ?? DEFAULT_PROFILE;
  const { protein, fat, carbs, calories, minimumCalories, tdee } =
    calculateGoals(profile, targetDuration(profile));
  const target = { protein, fat, carbs, calories };
  const excess = spreadCalorieExcess(date, logs, calories, minimumCalories);
  // 5%・100kcal・総赤字25%の制限は、急な食事制限を避けるためのアプリの設計値。
  const floor = Math.ceil(
    Math.max(minimumCalories, tdee * 0.75, protein * 4 + fat * 9),
  );
  const reduction = Math.max(
    0,
    Math.min(
      Math.round(excess.daily),
      Math.floor(calories * 0.05),
      100,
      calories - floor,
    ),
  );
  const adjustedCalories = calories - reduction;
  const limit = {
    ...target,
    calories: adjustedCalories,
    carbs: roundPFC((adjustedCalories - protein * 4 - fat * 9) / 4, 1),
  };
  const oldest = shiftDate(date, -7);
  const recorded = Object.values(logs).filter(
    (log) => log.date >= oldest && log.date < date && log.items.length > 0,
  );
  const total = sumPFC(recorded.map((log) => log.total));
  const average =
    recorded.length > 0
      ? mapPFC((key) => roundPFC(total[key] / recorded.length))
      : null;
  return {
    limit,
    target,
    adjustment: {
      calories: reduction > 0 ? -reduction : 0,
      outstandingCalories: roundPFC(excess.outstanding),
      minimumCalories: floor,
    },
    burnedCalories: burnedCalories(logs[date]),
    calorieRange: {
      min: Math.min(
        adjustedCalories,
        Math.max(floor, Math.round(adjustedCalories * 0.95)),
      ),
      max: Math.round(adjustedCalories * 1.05),
    },
    fatRange: {
      min: roundPFC((adjustedCalories * 0.2) / 9, 1),
      max: roundPFC((adjustedCalories * 0.3) / 9, 1),
    },
    weekly: {
      recordedDays: recorded.length,
      average,
      calorieDifference: average ? roundPFC(average.calories - calories) : null,
    },
  };
}
