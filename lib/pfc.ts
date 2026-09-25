import { PFC_KEYS, type PfcKey } from './macros';
import { EMPTY_PFC, type Logs, type PFC } from './types';
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

/** 栄養値を factor 倍する（数量 ×0.5 / ×2 などの記録用）。 */
export function scalePFC<T extends PFC>(food: T, factor: number): T {
  return { ...food, ...mapPFC((key) => roundPFC(food[key] * factor)) };
}

/**
 * currentDate の前日までの累積超過（負債）を計算する。
 * 最初の記録日から1日ずつ「その日の摂取 - 目標」を積み上げ、0 未満にはならない。
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
    const total = logs[date]?.total ?? EMPTY_PFC;
    for (const key of PFC_KEYS) {
      debt[key] = Math.max(0, debt[key] + total[key] - target[key]);
    }
  }
  return mapPFC((key) => roundPFC(debt[key]));
}
