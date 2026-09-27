import { PFC_KEYS, type PfcKey } from './macros';
import { EMPTY_PFC, type DailyLog, type Logs, type PFC } from './types';
import { roundPFC, shiftDate } from './utils';

function mapPFC(fn: (key: PfcKey) => number): PFC {
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

/** その日の運動による消費カロリーの合計。 */
export function burnedCalories(log: DailyLog | undefined): number {
  return roundPFC(
    (log?.activities ?? []).reduce(
      (total, activity) => total + activity.caloriesBurned,
      0,
    ),
  );
}

/** その日の目標。カロリーは運動の消費分だけ増える。 */
function dayTarget(target: PFC, log: DailyLog | undefined): PFC {
  return { ...target, calories: target.calories + burnedCalories(log) };
}

/** この日数だけ続けて食事を記録すると、翌日がチートデーになる。 */
export const CHEAT_DAY_STREAK = 6;

/** 食事を1件以上記録した日を「記録した日」とする。 */
function isRecorded(log: DailyLog | undefined): boolean {
  return (log?.items.length ?? 0) > 0;
}

interface PfcHistory {
  debt: PFC;
  /** currentDate の前日まで続いている記録の連続日数（チートデーを過ぎると 0 に戻る） */
  streak: number;
  isCheatDay: boolean;
}

/**
 * 最初の記録日から currentDate の前日までを1日ずつたどり、負債とチートデーの状態を求める。
 * 負債は「その日の摂取 - その日の目標」を積み上げ、0 未満にはならない。
 * CHEAT_DAY_STREAK 日続けて記録した翌日はチートデーで、その日の超過は負債に積まない（下回った分は返済する）。
 */
function walkPfcHistory(
  currentDate: string,
  target: PFC,
  logs: Logs,
): PfcHistory {
  const firstDate = Object.keys(logs).sort()[0];
  const debt: PFC = { ...EMPTY_PFC };
  let streak = 0;
  if (firstDate !== undefined) {
    for (let date = firstDate; date < currentDate; date = shiftDate(date, 1)) {
      const log = logs[date];
      const isCheatDay = streak >= CHEAT_DAY_STREAK;
      const total = log?.total ?? EMPTY_PFC;
      const goal = dayTarget(target, log);
      for (const key of PFC_KEYS) {
        const over = total[key] - goal[key];
        debt[key] = Math.max(
          0,
          debt[key] + (isCheatDay ? Math.min(0, over) : over),
        );
      }
      streak = !isCheatDay && isRecorded(log) ? streak + 1 : 0;
    }
  }
  return {
    debt: mapPFC((key) => roundPFC(debt[key])),
    streak,
    isCheatDay: streak >= CHEAT_DAY_STREAK,
  };
}

/** currentDate の前日までの累積超過（負債）。 */
export function computePfcDebt(
  currentDate: string,
  target: PFC,
  logs: Logs,
): PFC {
  return walkPfcHistory(currentDate, target, logs).debt;
}

export interface DailyLimit {
  /** 運動の消費分を足した目標から、前日までの超過を差し引いたその日の上限 */
  limit: PFC;
  /** 運動の消費分を足した目標 */
  target: PFC;
  debt: PFC;
  burnedCalories: number;
  /** チートデーなら true。上限を超えても負債にならない */
  isCheatDay: boolean;
  /** 前日まで続いている記録の連続日数 */
  streak: number;
}

export function computeDailyLimit(
  date: string,
  target: PFC,
  logs: Logs,
): DailyLimit {
  const log = logs[date];
  const goal = dayTarget(target, log);
  const { debt, streak, isCheatDay } = walkPfcHistory(date, target, logs);
  return {
    limit: mapPFC((key) => Math.max(0, roundPFC(goal[key] - debt[key]))),
    target: goal,
    debt,
    burnedCalories: burnedCalories(log),
    isCheatDay,
    streak,
  };
}
