import { PFC_KEYS, type PfcKey } from './macros';
import type { DailyLog, Logs, PFC, UserSettings } from './types';
import { roundPFC, shiftDate } from './utils';

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

/** その日の目標。カロリーは運動の消費分だけ増える。 */
function dayTarget(target: PFC, log: DailyLog | undefined): PFC {
  return { ...target, calories: target.calories + burnedCalories(log) };
}

/** この日数だけ続けて食事を記録すると、翌日がチートデーになる。 */
export const CHEAT_DAY_STREAK = 6;

/** 食事を1件以上記録した日を「記録した日」とする。 */
function isRecorded(log: DailyLog | undefined): log is DailyLog {
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

/** その日の超過・不足は、翌日からこの日数のあいだ上限に繰り越され、その後は消える。 */
export const CARRYOVER_DAYS = 7;

/** 繰越の1件。amount は正なら超過、負なら不足。 */
interface CarryoverLot {
  date: string;
  amount: number;
}

/** date の時点で期限（CARRYOVER_DAYS 日）が切れていない繰越。 */
function activeLots(lots: CarryoverLot[], date: string): CarryoverLot[] {
  const oldest = shiftDate(date, -CARRYOVER_DAYS);
  return lots.filter((lot) => lot.date >= oldest);
}

/**
 * 繰越の残りに新しい日の差分を加える。期限切れを捨ててから、
 * 符号が逆の繰越を古い順に相殺し、残った分を新しい繰越として積む。
 */
function addCarryover(
  lots: CarryoverLot[],
  date: string,
  amount: number,
): CarryoverLot[] {
  const next = activeLots(lots, date);
  let rest = amount;
  let head = next[0];
  while (head && rest * head.amount < 0) {
    const sum = head.amount + rest;
    if (sum * rest >= 0) {
      // 古い繰越を使い切り、残りを次の繰越の相殺に回す
      next.shift();
      head = next[0];
      rest = sum;
    } else {
      next[0] = { ...head, amount: sum };
      rest = 0;
    }
  }
  if (rest !== 0) next.push({ date, amount: rest });
  return next;
}

/** currentDate に効いている繰越の合計。 */
function carryoverTotal(lots: CarryoverLot[], currentDate: string): number {
  return activeLots(lots, currentDate).reduce(
    (total, lot) => total + lot.amount,
    0,
  );
}

/** 上限の計算に使う設定。 */
type CarryoverSettings = Pick<
  UserSettings,
  'targetPFC' | 'carryoverExcludedDates'
>;

interface PfcHistory {
  /** 前日までの超過（正）・不足（負）の繰越 */
  carryover: PFC;
  /** currentDate の前日まで続いている記録の連続日数（チートデーを過ぎると 0 に戻る） */
  streak: number;
  /** streak のうちカロリーを超過した日数 */
  overDays: number;
  isCheatDay: boolean;
}

/**
 * 最初の記録日から currentDate の前日までを1日ずつたどり、繰越とチートデーの状態を求める。
 * 記録した日の「その日の摂取 - その日の目標」を繰越とし、超過と不足は古い順に相殺する。
 * 各日の繰越は CARRYOVER_DAYS 日で消える。食事を記録していない日と、繰り越さない日に選んだ日は繰越に影響しない。
 * 繰り越さない日は記録の連続日数には数えるが、超過した日には数えない。
 * CHEAT_DAY_STREAK 日続けて記録した翌日はチートデーで、その日の超過は繰り越さない（下回った分は不足として繰り越す）。
 * ただし連続記録中に超過した日が多いと、免除する超過に上限が付く（cheatDayCap）。
 */
function walkPfcHistory(
  currentDate: string,
  { targetPFC: target, carryoverExcludedDates }: CarryoverSettings,
  logs: Logs,
): PfcHistory {
  const excluded = new Set(carryoverExcludedDates);
  const firstDate = Object.keys(logs).sort()[0];
  const lots = mapPFC<CarryoverLot[]>(() => []);
  let streak = 0;
  let overDays = 0;
  if (firstDate !== undefined) {
    for (let date = firstDate; date < currentDate; date = shiftDate(date, 1)) {
      const log = logs[date];
      const isCheatDay = streak >= CHEAT_DAY_STREAK;
      const goal = dayTarget(target, log);
      const carries = !excluded.has(date);
      if (isRecorded(log) && carries) {
        const cap = isCheatDay ? cheatDayCap(goal, overDays) : undefined;
        for (const key of PFC_KEYS) {
          const over = log.total[key] - goal[key];
          // チートデーは上限（null なら無制限）までの超過を免除する
          const forgiven =
            cap === undefined
              ? 0
              : Math.max(0, Math.min(over, cap?.[key] ?? over));
          lots[key] = addCarryover(lots[key], date, over - forgiven);
        }
      }
      if (!isCheatDay && isRecorded(log)) {
        streak += 1;
        if (carries && isOverDay(log, goal)) overDays += 1;
      } else {
        streak = 0;
        overDays = 0;
      }
    }
  }
  return {
    carryover: mapPFC((key) =>
      roundPFC(carryoverTotal(lots[key], currentDate)),
    ),
    streak,
    overDays,
    isCheatDay: streak >= CHEAT_DAY_STREAK,
  };
}

export interface DailyLimit {
  /** 運動の消費分を足した目標から、前日までの繰越を差し引いたその日の上限 */
  limit: PFC;
  /** 運動の消費分を足した目標 */
  target: PFC;
  /** 前日までの繰越。正なら超過（上限が減る）、負なら不足（上限が増える） */
  carryover: PFC;
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
  settings: CarryoverSettings,
  logs: Logs,
): DailyLimit {
  const log = logs[date];
  const goal = dayTarget(settings.targetPFC, log);
  const { carryover, streak, overDays, isCheatDay } = walkPfcHistory(
    date,
    settings,
    logs,
  );
  return {
    limit: mapPFC((key) => Math.max(0, roundPFC(goal[key] - carryover[key]))),
    target: goal,
    carryover,
    burnedCalories: burnedCalories(log),
    isCheatDay,
    cheatDayCap: isCheatDay ? cheatDayCap(goal, overDays) : null,
    streak,
    overDays,
  };
}
