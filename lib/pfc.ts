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
  /** 前日までの7日間。記録した日の平均であり、未記録日は0として数えない。 */
  weekly: {
    recordedDays: number;
    average: PFC | null;
    calorieDifference: number | null;
  };
}

/** 保存済みの旧目標ではなく、現在のプロフィールから共通の基準を計算する。 */
export function computeDailyLimit(
  date: string,
  settings: Pick<UserSettings, 'profile'>,
  logs: Logs,
): DailyLimit {
  const profile = settings.profile ?? DEFAULT_PROFILE;
  const { protein, fat, carbs, calories, minimumCalories } = calculateGoals(
    profile,
    targetDuration(profile),
  );
  const target = { protein, fat, carbs, calories };
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
    limit: target,
    target,
    burnedCalories: burnedCalories(logs[date]),
    calorieRange: {
      min: Math.max(minimumCalories, Math.round(calories * 0.95)),
      max: Math.round(calories * 1.05),
    },
    fatRange: {
      min: roundPFC((calories * 0.2) / 9, 1),
      max: roundPFC((calories * 0.3) / 9, 1),
    },
    weekly: {
      recordedDays: recorded.length,
      average,
      calorieDifference: average ? roundPFC(average.calories - calories) : null,
    },
  };
}
