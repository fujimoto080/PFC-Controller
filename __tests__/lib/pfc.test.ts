import {
  CHEAT_DAY_STREAK,
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
import { shiftDate } from '@/lib/utils';

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
      isCheatDay: false,
      cheatDayCap: null,
      streak: 0,
      overDays: 0,
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

/** start から days 日分、total の食事を1件ずつ記録したログ。 */
function recordedDays(start: string, days: number, total: PFC): Logs {
  return Object.fromEntries(
    Array.from({ length: days }, (_, i) => {
      const date = shiftDate(start, i);
      const item = { id: date, name: '食事', timestamp: i, ...total };
      return [date, { ...createEmptyDailyLog(date), items: [item], total }];
    }),
  );
}

describe('チートデー', () => {
  const start = '2026-09-01';
  const cheatDate = shiftDate(start, CHEAT_DAY_STREAK);

  it('続けて記録した日数を数え、規定日数に達した翌日がチートデーになる', () => {
    const logs = recordedDays(start, CHEAT_DAY_STREAK, target);
    expect(
      computeDailyLimit(shiftDate(cheatDate, -1), target, logs),
    ).toMatchObject({ isCheatDay: false, streak: CHEAT_DAY_STREAK - 1 });
    expect(computeDailyLimit(cheatDate, target, logs)).toMatchObject({
      isCheatDay: true,
      streak: CHEAT_DAY_STREAK,
    });
  });

  it('記録の無い日があると数え直す', () => {
    // 3日目だけ記録が無い
    const logs = {
      ...recordedDays(start, 2, target),
      ...recordedDays(shiftDate(start, 3), CHEAT_DAY_STREAK - 3, target),
    };
    expect(computeDailyLimit(cheatDate, target, logs)).toMatchObject({
      isCheatDay: false,
      streak: CHEAT_DAY_STREAK - 3,
    });
  });

  it('チートデーの超過は負債にならず、翌日から数え直す', () => {
    const logs = {
      ...recordedDays(start, CHEAT_DAY_STREAK, target),
      ...recordedDays(cheatDate, 1, { ...target, calories: 3500 }),
    };
    const nextDay = shiftDate(cheatDate, 1);
    expect(computeDailyLimit(nextDay, target, logs)).toMatchObject({
      debt: { calories: 0 },
      isCheatDay: false,
      cheatDayCap: null,
      streak: 0,
      overDays: 0,
    });
  });

  it('超過した日が少なければ免除は無制限', () => {
    const logs = {
      ...recordedDays(start, 1, { ...target, calories: 2500 }),
      ...recordedDays(shiftDate(start, 1), CHEAT_DAY_STREAK - 1, target),
    };
    expect(computeDailyLimit(cheatDate, target, logs)).toMatchObject({
      isCheatDay: true,
      cheatDayCap: null,
      overDays: 1,
    });
  });

  it('超過した日が多いと免除に上限が付き、上限を超えた分は負債になる', () => {
    // 2日超過（+100kcal ずつ）、残り4日は目標どおり
    const logs = {
      ...recordedDays(start, 2, { ...target, calories: 2100 }),
      ...recordedDays(shiftDate(start, 2), CHEAT_DAY_STREAK - 2, target),
      ...recordedDays(cheatDate, 1, { ...target, calories: 3500 }),
    };
    // 超過しなかった4日 × 10% = 目標の40%
    expect(computeDailyLimit(cheatDate, target, logs)).toMatchObject({
      isCheatDay: true,
      overDays: 2,
      cheatDayCap: { protein: 40, fat: 20, carbs: 80, calories: 800 },
    });
    // 前日までの負債200 + 超過1500 - 免除800
    expect(computePfcDebt(shiftDate(cheatDate, 1), target, logs).calories).toBe(
      900,
    );
  });

  it('チートデーに目標を下回れば負債を返済する', () => {
    const logs = {
      ...recordedDays(start, 1, { ...target, calories: 2500 }),
      ...recordedDays(shiftDate(start, 1), CHEAT_DAY_STREAK - 1, target),
      ...recordedDays(cheatDate, 1, { ...target, calories: 1800 }),
    };
    expect(computePfcDebt(cheatDate, target, logs).calories).toBe(500);
    expect(computePfcDebt(shiftDate(cheatDate, 1), target, logs).calories).toBe(
      300,
    );
  });
});
