import {
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
import {
  DEFAULT_PROFILE,
  calculateGoals,
  targetDuration,
} from '@/lib/nutrition-goals';
import { shiftDate } from '@/lib/utils';

const target: PFC = { protein: 100, fat: 50, carbs: 200, calories: 2000 };
const settings = { profile: DEFAULT_PROFILE };

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
  it('運動の記録値を合計する', () => {
    expect(burnedCalories(activityLog('2026-09-25', target, [300, 150]))).toBe(
      450,
    );
    expect(burnedCalories(undefined)).toBe(0);
  });
});

describe('computeDailyLimit', () => {
  it('前後の不足と超過が相殺できていれば、週平均が基本目標内のまま減額しない', () => {
    const base = computeDailyLimit('2026-09-01', settings, {}).target;
    for (const first of [-200, 200]) {
      const logs = logsOf({
        '2026-09-01': { ...base, calories: base.calories + first },
        '2026-09-02': { ...base, calories: base.calories - first },
      });
      expect(computeDailyLimit('2026-09-03', settings, logs).limit).toEqual(
        base,
      );
    }
  });
  it('350kcalの超過を7日で分散し、実際の摂取差だけで相殺する', () => {
    const base = computeDailyLimit('2026-09-01', settings, {}).target;
    const logs = logsOf({
      '2026-09-01': { ...base, calories: base.calories + 350 },
    });
    for (let i = 1; i <= 7; i += 1) {
      const date = shiftDate('2026-09-01', i);
      const day = computeDailyLimit(date, settings, logs);
      expect(day.adjustment.calories).toBe(-50);
      expect(day.limit.protein).toBe(base.protein);
      expect(day.limit.fat).toBe(base.fat);
      expect(
        Math.abs(
          day.limit.protein * 4 +
            day.limit.fat * 9 +
            day.limit.carbs * 4 -
            day.limit.calories,
        ),
      ).toBeLessThan(1);
      logs[date] = recordedLog(date, day.limit);
    }
    expect(
      computeDailyLimit('2026-09-09', settings, logs).adjustment.calories,
    ).toBe(0);
  });
  it('調整しただけでは返済扱いにせず、7日を過ぎた超過は持ち越さない', () => {
    const base = computeDailyLimit('2026-09-01', settings, {}).target;
    const logs = logsOf({
      '2026-09-01': { ...base, calories: base.calories + 350 },
    });
    logs['2026-09-02'] = recordedLog('2026-09-02', base);
    expect(
      computeDailyLimit('2026-09-03', settings, logs).adjustment
        .outstandingCalories,
    ).toBe(350);
    expect(
      computeDailyLimit('2026-09-09', settings, logs).adjustment
        .outstandingCalories,
    ).toBe(0);
  });
  it('不足・未記録・少なすぎる記録から食事枠を増やさない', () => {
    const base = computeDailyLimit('2026-09-01', settings, {}).target;
    const logs = logsOf({ '2026-09-01': { ...base, calories: 500 } });
    expect(computeDailyLimit('2026-09-02', settings, logs).limit).toEqual(base);
    logs['2026-09-02'] = recordedLog('2026-09-02', {
      ...base,
      calories: base.calories + 350,
    });
    logs['2026-09-03'] = recordedLog('2026-09-03', { ...base, calories: 500 });
    expect(
      computeDailyLimit('2026-09-04', settings, logs).adjustment
        .outstandingCalories,
    ).toBe(350);
  });
  it('カロリーが収まっている場合は炭水化物だけの超過を返済させない', () => {
    const base = computeDailyLimit('2026-09-01', settings, {}).target;
    const logs = logsOf({ '2026-09-01': { ...base, carbs: base.carbs + 80 } });
    expect(computeDailyLimit('2026-09-02', settings, logs).limit).toEqual(base);
  });
  it('基本目標が最低カロリーなら、超過があってもさらに減らさない', () => {
    const lowSettings = {
      profile: {
        ...DEFAULT_PROFILE,
        gender: 'female' as const,
        height: 150,
        age: 50,
        weight: 45,
        targetWeight: 40,
        activityLevel: 1.2,
      },
    };
    const base = computeDailyLimit('2026-09-01', lowSettings, {}).target;
    const logs = logsOf({
      '2026-09-01': { ...base, calories: base.calories + 1000 },
    });
    expect(base.calories).toBe(1200);
    expect(
      computeDailyLimit('2026-09-02', lowSettings, logs).limit.calories,
    ).toBe(1200);
  });
  it('運動は二重計上せず、超過は減額の上限内で調整する', () => {
    const logs = logsOf({
      '2026-09-24': { protein: 0, fat: 0, carbs: 0, calories: 4000 },
    });
    logs['2026-09-25'] = activityLog('2026-09-25', target, [600]);
    const result = computeDailyLimit('2026-09-25', settings, logs);
    expect(result.adjustment.calories).toBe(
      -Math.floor(result.target.calories * 0.05),
    );
    expect(result.limit.protein).toBe(result.target.protein);
    expect(result.limit.fat).toBe(result.target.fat);
    expect(result.limit.calories).toBeGreaterThanOrEqual(
      result.adjustment.minimumCalories,
    );
    expect(result.burnedCalories).toBe(600);
  });
  it('前日まで7日間の記録日だけで平均を計算する', () => {
    const logs = logsOf({
      '2026-08-30': { ...target, calories: 9000 },
      '2026-08-31': { ...target, calories: 1800 },
      '2026-09-06': { ...target, calories: 2200 },
      '2026-09-07': { ...target, calories: 9000 },
      '2026-09-08': { ...target, calories: 9000 },
    });
    logs['2026-09-04'] = createEmptyDailyLog('2026-09-04');
    const result = computeDailyLimit('2026-09-07', settings, logs);
    expect(result.weekly.recordedDays).toBe(2);
    expect(result.weekly.average?.calories).toBe(2000);
    expect(result.weekly.calorieDifference).toBe(2000 - result.target.calories);
  });
  it('未記録日は不足扱いにしない', () => {
    expect(computeDailyLimit('2026-09-25', settings, {}).weekly).toEqual({
      recordedDays: 0,
      average: null,
      calorieDifference: null,
    });
  });
  it('プロフィールがない場合も共通の既定プロフィールを使う', () => {
    const { protein, fat, carbs, calories } = calculateGoals(
      DEFAULT_PROFILE,
      targetDuration(DEFAULT_PROFILE),
    );
    expect(computeDailyLimit('2026-09-25', {}, {}).limit).toEqual({
      protein,
      fat,
      carbs,
      calories,
    });
  });
});
