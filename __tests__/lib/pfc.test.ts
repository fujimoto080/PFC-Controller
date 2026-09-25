import {
  activityAdjustedCalorieTarget,
  computePfcDebt,
  sumPFC,
  weeklyAverage,
} from '@/lib/pfc';
import { createEmptyDailyLog, type Logs, type PFC } from '@/lib/types';

const target: PFC = { protein: 100, fat: 50, carbs: 200, calories: 2000 };

function logsOf(totals: Record<string, PFC>): Logs {
  return Object.fromEntries(
    Object.entries(totals).map(([date, total]) => [date, { ...createEmptyDailyLog(date), total }]),
  );
}

describe('sumPFC', () => {
  it('合計を小数第2位で丸める', () => {
    expect(
      sumPFC([
        { protein: 0.1, fat: 0.2, carbs: 0.3, calories: 1 },
        { protein: 0.2, fat: 0.1, carbs: 0.004, calories: 2 },
      ]),
    ).toEqual({ protein: 0.3, fat: 0.3, carbs: 0.3, calories: 3 });
  });

  it('空配列は 0', () => {
    expect(sumPFC([])).toEqual({ protein: 0, fat: 0, carbs: 0, calories: 0 });
  });
});

describe('computePfcDebt', () => {
  it('記録が無ければ 0', () => {
    expect(computePfcDebt('2026-09-25', target, {})).toEqual({
      protein: 0,
      fat: 0,
      carbs: 0,
      calories: 0,
    });
  });

  it('前日までの超過を積み上げ、記録の無い日は目標分だけ返済される', () => {
    const logs = logsOf({
      '2026-09-20': { protein: 150, fat: 50, carbs: 200, calories: 3000 },
      // 09-21 は記録なし（摂取 0 として目標分返済）
      '2026-09-22': { protein: 100, fat: 80, carbs: 200, calories: 2500 },
    });
    expect(computePfcDebt('2026-09-23', target, logs)).toEqual({
      protein: 0,
      fat: 30,
      carbs: 0,
      calories: 500,
    });
  });

  it('当日以降の記録は含めない', () => {
    const logs = logsOf({ '2026-09-25': { protein: 500, fat: 500, carbs: 500, calories: 9000 } });
    expect(computePfcDebt('2026-09-25', target, logs).calories).toBe(0);
  });

  it('月をまたいでも日付を正しく進める', () => {
    const logs = logsOf({ '2026-08-31': { protein: 100, fat: 50, carbs: 200, calories: 2600 } });
    expect(computePfcDebt('2026-09-01', target, logs).calories).toBe(600);
    expect(computePfcDebt('2026-09-02', target, logs).calories).toBe(0);
  });
});

describe('weeklyAverage', () => {
  it('当日を含む過去7日間の合計を7で割る', () => {
    const logs = logsOf({
      '2026-09-25': { protein: 70, fat: 7, carbs: 14, calories: 700 },
      '2026-09-19': { protein: 70, fat: 7, carbs: 14, calories: 700 },
      '2026-09-18': { protein: 700, fat: 700, carbs: 700, calories: 7000 }, // 範囲外
    });
    expect(weeklyAverage(logs, '2026-09-25')).toEqual({
      protein: 20,
      fat: 2,
      carbs: 4,
      calories: 200,
    });
  });
});

describe('activityAdjustedCalorieTarget', () => {
  it('運動の消費カロリーを目標に加算する', () => {
    const log = {
      ...createEmptyDailyLog('2026-09-25'),
      activities: [
        { id: 'a', sportId: 'walking', name: 'ウォーキング', caloriesBurned: 180, timestamp: 1 },
        { id: 'b', sportId: 'running', name: 'ランニング', caloriesBurned: 320, timestamp: 2 },
      ],
    };
    expect(activityAdjustedCalorieTarget(2000, log)).toBe(2500);
  });
});
