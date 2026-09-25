import {
  burnedCalories,
  computeDailyLimit,
  computePfcDebt,
  scalePFC,
  subtractPFC,
  sumPFC,
} from '@/lib/pfc';
import {
  createEmptyDailyLog,
  type DailyLog,
  type Logs,
  type PFC,
} from '@/lib/types';

const target: PFC = { protein: 100, fat: 50, carbs: 200, calories: 2000 };

function logsOf(totals: Record<string, PFC>): Logs {
  return Object.fromEntries(
    Object.entries(totals).map(([date, total]) => [
      date,
      { ...createEmptyDailyLog(date), total },
    ]),
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

describe('subtractPFC', () => {
  it('差を小数第2位で丸め、負の値も返す', () => {
    expect(
      subtractPFC(target, {
        protein: 30.333,
        fat: 60,
        carbs: 0,
        calories: 500,
      }),
    ).toEqual({ protein: 69.67, fat: -10, carbs: 200, calories: 1500 });
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
    const logs = logsOf({
      '2026-09-25': { protein: 500, fat: 500, carbs: 500, calories: 9000 },
    });
    expect(computePfcDebt('2026-09-25', target, logs).calories).toBe(0);
  });

  it('月をまたいでも日付を正しく進める', () => {
    const logs = logsOf({
      '2026-08-31': { protein: 100, fat: 50, carbs: 200, calories: 2600 },
    });
    expect(computePfcDebt('2026-09-01', target, logs).calories).toBe(600);
    expect(computePfcDebt('2026-09-02', target, logs).calories).toBe(0);
  });
});

describe('scalePFC', () => {
  it('栄養値だけを倍率で掛け、他の項目は保つ', () => {
    expect(
      scalePFC(
        { name: 'おにぎり', protein: 3.3, fat: 1, carbs: 40, calories: 185 },
        1.5,
      ),
    ).toEqual({
      name: 'おにぎり',
      protein: 4.95,
      fat: 1.5,
      carbs: 60,
      calories: 277.5,
    });
  });
});

function activityLog(date: string, total: PFC, burned: number[]): DailyLog {
  return {
    ...createEmptyDailyLog(date),
    total,
    activities: burned.map((caloriesBurned, i) => ({
      id: `${date}-${i}`,
      sportId: 'swim',
      name: '水泳',
      caloriesBurned,
      timestamp: i,
    })),
  };
}

describe('burnedCalories', () => {
  it('運動の消費カロリーを合計する', () => {
    expect(burnedCalories(activityLog('2026-09-25', target, [300, 150]))).toBe(
      450,
    );
  });

  it('ログが無ければ 0', () => {
    expect(burnedCalories(undefined)).toBe(0);
  });
});

describe('運動を考慮した上限', () => {
  it('運動した日は消費分だけ目標カロリーが増え、負債が減る', () => {
    const logs: Logs = {
      '2026-09-24': activityLog(
        '2026-09-24',
        { protein: 100, fat: 50, carbs: 200, calories: 2300 },
        [300],
      ),
    };
    expect(computePfcDebt('2026-09-25', target, logs).calories).toBe(0);
  });

  it('当日の上限 = 目標 + 当日の運動 − 前日までの超過', () => {
    const logs: Logs = {
      '2026-09-24': activityLog(
        '2026-09-24',
        { protein: 120, fat: 50, carbs: 200, calories: 2500 },
        [],
      ),
      '2026-09-25': activityLog('2026-09-25', { ...target }, [400]),
    };
    expect(computeDailyLimit('2026-09-25', target, logs)).toEqual({
      limit: { protein: 80, fat: 50, carbs: 200, calories: 1900 },
      target: { ...target, calories: 2400 },
      debt: { protein: 20, fat: 0, carbs: 0, calories: 500 },
      burnedCalories: 400,
    });
  });

  it('上限は 0 未満にならない', () => {
    const logs = logsOf({
      '2026-09-24': { protein: 0, fat: 0, carbs: 0, calories: 9000 },
    });
    expect(computeDailyLimit('2026-09-25', target, logs).limit.calories).toBe(
      0,
    );
  });
});
