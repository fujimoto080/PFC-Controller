import { EMPTY_PFC, type DailyLog, type Logs, type PFC } from './types';
import { formatDate, roundPFC } from './utils';

const PFC_KEYS = ['protein', 'fat', 'carbs', 'calories'] as const;

function mapPFC(fn: (key: (typeof PFC_KEYS)[number]) => number): PFC {
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

/** 目標に対する摂取割合(%)。0〜100 にクランプする。target<=0 の場合は 0。 */
export function progressPct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

/** 閾値を超えているとき強調（赤・太字）、そうでなければ控えめな色を返す。 */
export function overLimitTextClass(current: number, threshold: number): string {
  return current > threshold
    ? 'text-red-500 font-bold'
    : 'text-muted-foreground';
}

/** 運動による消費カロリーを加算したカロリー目標。 */
export function activityAdjustedCalorieTarget(
  targetCalories: number,
  log: DailyLog,
): number {
  const burned = log.activities.reduce(
    (total, activity) => total + activity.caloriesBurned,
    0,
  );
  return Math.max(0, targetCalories + burned);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** JST の日付文字列(YYYY-MM-DD)に日数を加算する。JST は夏時間が無いため固定長で加算できる。 */
function addDays(date: string, days: number): string {
  return formatDate(
    new Date(`${date}T00:00:00+09:00`).getTime() + days * DAY_MS,
  );
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

  for (let date = firstDate; date < currentDate; date = addDays(date, 1)) {
    const total = logs[date]?.total ?? EMPTY_PFC;
    for (const key of PFC_KEYS) {
      debt[key] = Math.max(0, debt[key] + total[key] - target[key]);
    }
  }
  return mapPFC((key) => roundPFC(debt[key]));
}

/** today を含む過去7日間の1日あたり平均（記録の無い日は 0 として扱う）。 */
export function weeklyAverage(logs: Logs, today: string): PFC {
  const totals = Array.from(
    { length: 7 },
    (_, i) => logs[addDays(today, -i)]?.total ?? EMPTY_PFC,
  );
  return mapPFC((key) =>
    roundPFC(totals.reduce((acc, t) => acc + t[key], 0) / 7),
  );
}
