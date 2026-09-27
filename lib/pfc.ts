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

/** 連続記録中にカロリーを超過した日がこの日数までなら、チートデーの超過は無制限に免除する。 */
export const CHEAT_DAY_FREE_OVER_DAYS = 1;

/** 超過した日がそれより多いとき、超過しなかった日1日につき目標のこの割合まで免除する。 */
const CHEAT_DAY_ALLOWANCE_PER_DAY = 0.1;

/** カロリーが目標を超えた日。 */
function isOverDay(log: DailyLog | undefined, goal: PFC): boolean {
  return (log?.total.calories ?? 0) > goal.calories;
}

/**
 * チートデーに負債を免除する超過の上限。超過した日が少なければ null（無制限）。
 * 多ければ、連続記録のうち超過しなかった日数に応じて上限を付ける。
 */
function cheatDayCap(goal: PFC, overDays: number): PFC | null {
  if (overDays <= CHEAT_DAY_FREE_OVER_DAYS) return null;
  const ratio =
    CHEAT_DAY_ALLOWANCE_PER_DAY * Math.max(0, CHEAT_DAY_STREAK - overDays);
  return mapPFC((key) => roundPFC(goal[key] * ratio));
}

interface PfcHistory {
  debt: PFC;
  /** currentDate の前日まで続いている記録の連続日数（チートデーを過ぎると 0 に戻る） */
  streak: number;
  /** streak のうちカロリーを超過した日数 */
  overDays: number;
  isCheatDay: boolean;
}

/**
 * 最初の記録日から currentDate の前日までを1日ずつたどり、負債とチートデーの状態を求める。
 * 負債は「その日の摂取 - その日の目標」を積み上げ、0 未満にはならない。
 * CHEAT_DAY_STREAK 日続けて記録した翌日はチートデーで、その日の超過は負債に積まない（下回った分は返済する）。
 * ただし連続記録中に超過した日が多いと、免除する超過に上限が付く（cheatDayCap）。
 */
function walkPfcHistory(
  currentDate: string,
  target: PFC,
  logs: Logs,
): PfcHistory {
  const firstDate = Object.keys(logs).sort()[0];
  const debt: PFC = { ...EMPTY_PFC };
  let streak = 0;
  let overDays = 0;
  if (firstDate !== undefined) {
    for (let date = firstDate; date < currentDate; date = shiftDate(date, 1)) {
      const log = logs[date];
      const isCheatDay = streak >= CHEAT_DAY_STREAK;
      const total = log?.total ?? EMPTY_PFC;
      const goal = dayTarget(target, log);
      const cap = isCheatDay ? cheatDayCap(goal, overDays) : undefined;
      for (const key of PFC_KEYS) {
        const over = total[key] - goal[key];
        // チートデーは上限（null なら無制限）までの超過を免除する
        const forgiven =
          cap === undefined
            ? 0
            : Math.max(0, Math.min(over, cap?.[key] ?? over));
        debt[key] = Math.max(0, debt[key] + over - forgiven);
      }
      if (!isCheatDay && isRecorded(log)) {
        streak += 1;
        if (isOverDay(log, goal)) overDays += 1;
      } else {
        streak = 0;
        overDays = 0;
      }
    }
  }
  return {
    debt: mapPFC((key) => roundPFC(debt[key])),
    streak,
    overDays,
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
  /** チートデーなら true。上限を超えても負債にならない（cheatDayCap があればその分まで） */
  isCheatDay: boolean;
  /** チートデーに負債を免除する超過の上限。null なら無制限（チートデーでない日も null） */
  cheatDayCap: PFC | null;
  /** 前日まで続いている記録の連続日数 */
  streak: number;
  /** streak のうちカロリーを超過した日数 */
  overDays: number;
}

export function computeDailyLimit(
  date: string,
  target: PFC,
  logs: Logs,
): DailyLimit {
  const log = logs[date];
  const goal = dayTarget(target, log);
  const { debt, streak, overDays, isCheatDay } = walkPfcHistory(
    date,
    target,
    logs,
  );
  return {
    limit: mapPFC((key) => Math.max(0, roundPFC(goal[key] - debt[key]))),
    target: goal,
    debt,
    burnedCalories: burnedCalories(log),
    isCheatDay,
    cheatDayCap: isCheatDay ? cheatDayCap(goal, overDays) : null,
    streak,
    overDays,
  };
}
