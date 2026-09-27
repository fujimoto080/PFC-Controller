import {
  CARRYOVER_DAYS,
  CHEAT_DAY_STREAK,
  burnedCalories,
  computeDailyLimit,
  hasNutrition,
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
const settings = { targetPFC: target, carryoverExcludedDates: [] };

/** 摂取合計が total の食事を1件記録したその日のログ。 */
function recordedLog(date: string, total: PFC): DailyLog {
  const item = { id: date, name: '食事', timestamp: 0, ...total };
  return { ...createEmptyDailyLog(date), items: [item], total };
}

function logsOf(totals: Record<string, PFC>): Logs {
  return Object.fromEntries(
    Object.entries(totals).map(([date, total]) => [
      date,
      recordedLog(date, total),
    ]),
  );
}

/** date の前日までの繰越。 */
function carryoverOn(date: string, logs: Logs): PFC {
  return computeDailyLimit(date, settings, logs).carryover;
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

describe('繰越', () => {
  it('記録が無ければ 0', () => {
    expect(carryoverOn('2026-09-25', {})).toEqual({
      protein: 0,
      fat: 0,
      carbs: 0,
      calories: 0,
    });
  });

  it('超過と不足を相殺し、記録の無い日は影響しない', () => {
    const logs = logsOf({
      '2026-09-20': { protein: 150, fat: 50, carbs: 200, calories: 3000 },
      // 09-21 は記録なし
      '2026-09-22': { protein: 100, fat: 80, carbs: 150, calories: 1700 },
    });
    expect(carryoverOn('2026-09-23', logs)).toEqual({
      protein: 50,
      fat: 30,
      carbs: -50,
      calories: 700,
    });
  });

  it('不足の繰越は上限を増やす', () => {
    const logs = logsOf({
      '2026-09-24': { protein: 80, fat: 50, carbs: 200, calories: 1500 },
    });
    expect(computeDailyLimit('2026-09-25', settings, logs).limit).toEqual({
      protein: 120,
      fat: 50,
      carbs: 200,
      calories: 2500,
    });
  });

  it('当日以降の記録は含めない', () => {
    const logs = logsOf({
      '2026-09-25': { protein: 500, fat: 500, carbs: 500, calories: 9000 },
    });
    expect(carryoverOn('2026-09-25', logs).calories).toBe(0);
  });

  it(`各日の繰越は${CARRYOVER_DAYS}日で消える（月をまたいでも日付を正しく進める）`, () => {
    const logs = logsOf({
      '2026-08-31': { protein: 100, fat: 50, carbs: 200, calories: 2600 },
    });
    expect(carryoverOn('2026-09-01', logs).calories).toBe(600);
    expect(
      carryoverOn(shiftDate('2026-08-31', CARRYOVER_DAYS), logs).calories,
    ).toBe(600);
    expect(
      carryoverOn(shiftDate('2026-08-31', CARRYOVER_DAYS + 1), logs).calories,
    ).toBe(0);
  });

  it('相殺で残った超過は元の日の期限で消え、相殺に使った不足は戻らない', () => {
    const logs = logsOf({
      '2026-09-01': { ...target, calories: 2600 },
      '2026-09-05': { ...target, calories: 1800 },
    });
    expect(carryoverOn('2026-09-06', logs).calories).toBe(400);
    expect(carryoverOn('2026-09-09', logs).calories).toBe(0);
  });

  it('繰り越さない日に選んだ日は、超過も不足も繰り越さない', () => {
    const logs = logsOf({
      '2026-09-20': { ...target, calories: 2500 },
      '2026-09-21': { ...target, calories: 800 },
    });
    const excluding = { ...settings, carryoverExcludedDates: ['2026-09-21'] };
    expect(
      computeDailyLimit('2026-09-22', excluding, logs).carryover.calories,
    ).toBe(500);
  });

  it('繰り越さない日も記録の連続日数には数え、超過した日には数えない', () => {
    const logs = recordedDays('2026-09-01', 2, { ...target, calories: 2500 });
    const excluding = { ...settings, carryoverExcludedDates: ['2026-09-02'] };
    expect(computeDailyLimit('2026-09-03', excluding, logs)).toMatchObject({
      streak: 2,
      overDays: 1,
    });
  });

  it('不足が超過を上回れば、残りを不足として繰り越す', () => {
    const logs = logsOf({
      '2026-09-01': { ...target, calories: 2300 },
      '2026-09-02': { ...target, calories: 1500 },
    });
    expect(carryoverOn('2026-09-03', logs).calories).toBe(-200);
    expect(
      carryoverOn(shiftDate('2026-09-02', CARRYOVER_DAYS), logs).calories,
    ).toBe(-200);
    expect(
      carryoverOn(shiftDate('2026-09-02', CARRYOVER_DAYS + 1), logs).calories,
    ).toBe(0);
  });
});

describe('hasNutrition', () => {
  it('全部 0 なら false、どれかが 0 より大きければ true', () => {
    expect(hasNutrition({ protein: 0, fat: 0, carbs: 0, calories: 0 })).toBe(
      false,
    );
    expect(hasNutrition({ protein: 0, fat: 0, carbs: 0, calories: 5 })).toBe(
      true,
    );
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
    ...recordedLog(date, total),
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
  it('運動した日は消費分だけ目標カロリーが増え、超過が減る', () => {
    const logs: Logs = {
      '2026-09-24': activityLog(
        '2026-09-24',
        { protein: 100, fat: 50, carbs: 200, calories: 2300 },
        [300],
      ),
    };
    expect(carryoverOn('2026-09-25', logs).calories).toBe(0);
  });

  it('当日の上限 = 目標 + 当日の運動 − 前日までの繰越', () => {
    const logs: Logs = {
      '2026-09-24': activityLog(
        '2026-09-24',
        { protein: 120, fat: 50, carbs: 200, calories: 2500 },
        [],
      ),
      '2026-09-25': activityLog('2026-09-25', { ...target }, [400]),
    };
    expect(computeDailyLimit('2026-09-25', settings, logs)).toEqual({
      limit: { protein: 80, fat: 50, carbs: 200, calories: 1900 },
      target: { ...target, calories: 2400 },
      carryover: { protein: 20, fat: 0, carbs: 0, calories: 500 },
      burnedCalories: 400,
      isCheatDay: false,
      cheatDayCap: null,
      streak: 1,
      overDays: 1,
    });
  });

  it('上限は 0 未満にならない', () => {
    const logs = logsOf({
      '2026-09-24': { protein: 0, fat: 0, carbs: 0, calories: 9000 },
    });
    expect(computeDailyLimit('2026-09-25', settings, logs).limit.calories).toBe(
      0,
    );
  });
});

/** start から days 日分、total の食事を1件ずつ記録したログ。 */
function recordedDays(start: string, days: number, total: PFC): Logs {
  return Object.fromEntries(
    Array.from({ length: days }, (_, i) => {
      const date = shiftDate(start, i);
      return [date, recordedLog(date, total)];
    }),
  );
}

describe('チートデー', () => {
  const start = '2026-09-01';
  const cheatDate = shiftDate(start, CHEAT_DAY_STREAK);

  it('続けて記録した日数を数え、規定日数に達した翌日がチートデーになる', () => {
    const logs = recordedDays(start, CHEAT_DAY_STREAK, target);
    expect(
      computeDailyLimit(shiftDate(cheatDate, -1), settings, logs),
    ).toMatchObject({ isCheatDay: false, streak: CHEAT_DAY_STREAK - 1 });
    expect(computeDailyLimit(cheatDate, settings, logs)).toMatchObject({
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
    expect(computeDailyLimit(cheatDate, settings, logs)).toMatchObject({
      isCheatDay: false,
      streak: CHEAT_DAY_STREAK - 3,
    });
  });

  it('チートデーの超過は繰り越さず、翌日から数え直す', () => {
    const logs = {
      ...recordedDays(start, CHEAT_DAY_STREAK, target),
      ...recordedDays(cheatDate, 1, { ...target, calories: 3500 }),
    };
    const nextDay = shiftDate(cheatDate, 1);
    expect(computeDailyLimit(nextDay, settings, logs)).toMatchObject({
      carryover: { calories: 0 },
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
    expect(computeDailyLimit(cheatDate, settings, logs)).toMatchObject({
      isCheatDay: true,
      cheatDayCap: null,
      overDays: 1,
    });
  });

  it('超過した日が多いと免除に上限が付き、上限を超えた分は繰り越す', () => {
    // 2日超過（+100kcal ずつ）、残り4日は目標どおり
    const logs = {
      ...recordedDays(start, 2, { ...target, calories: 2100 }),
      ...recordedDays(shiftDate(start, 2), CHEAT_DAY_STREAK - 2, target),
      ...recordedDays(cheatDate, 1, { ...target, calories: 3500 }),
    };
    // 超過しなかった4日 × 10% = 目標の40%
    expect(computeDailyLimit(cheatDate, settings, logs)).toMatchObject({
      isCheatDay: true,
      overDays: 2,
      cheatDayCap: { protein: 40, fat: 20, carbs: 80, calories: 800 },
    });
    // 前日までの繰越200 + 超過1500 - 免除800
    expect(carryoverOn(shiftDate(cheatDate, 1), logs).calories).toBe(900);
  });

  it('チートデーに目標を下回れば超過の繰越と相殺する', () => {
    const logs = {
      ...recordedDays(start, 1, { ...target, calories: 2500 }),
      ...recordedDays(shiftDate(start, 1), CHEAT_DAY_STREAK - 1, target),
      ...recordedDays(cheatDate, 1, { ...target, calories: 1800 }),
    };
    expect(carryoverOn(cheatDate, logs).calories).toBe(500);
    expect(carryoverOn(shiftDate(cheatDate, 1), logs).calories).toBe(300);
  });
});
