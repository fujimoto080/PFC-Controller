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

/**
 * currentDate の前日までの累積超過（負債）を計算する。
 * 最初の記録日から1日ずつ「その日の摂取 - その日の目標」を積み上げ、0 未満にはならない。
 */
export function computePfcDebt(
  currentDate: string,
  target: PFC,
  logs: Logs,
): PFC {
  const firstDate = Object.keys(logs).sort()[0];
  const debt: PFC = { ...EMPTY_PFC };
  if (firstDate === undefined) return debt;

  for (let date = firstDate; date < currentDate; date = shiftDate(date, 1)) {
    const log = logs[date];
    const total = log?.total ?? EMPTY_PFC;
    const goal = dayTarget(target, log);
    for (const key of PFC_KEYS) {
      debt[key] = Math.max(0, debt[key] + total[key] - goal[key]);
    }
  }
  return mapPFC((key) => roundPFC(debt[key]));
}

export interface DailyLimit {
  /** 運動の消費分を足した目標から、前日までの超過を差し引いたその日の上限 */
  limit: PFC;
  /** 運動の消費分を足した目標 */
  target: PFC;
  debt: PFC;
  burnedCalories: number;
}

export function computeDailyLimit(
  date: string,
  target: PFC,
  logs: Logs,
): DailyLimit {
  const log = logs[date];
  const goal = dayTarget(target, log);
  const debt = computePfcDebt(date, target, logs);
  return {
    limit: mapPFC((key) => Math.max(0, roundPFC(goal[key] - debt[key]))),
    target: goal,
    debt,
    burnedCalories: burnedCalories(log),
  };
}
