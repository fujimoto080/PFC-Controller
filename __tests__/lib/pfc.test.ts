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
  it('過去の過不足や運動記録で今日の目標を変更しない', () => {
    const logs = logsOf({
      '2026-09-24': { protein: 0, fat: 0, carbs: 0, calories: 4000 },
    });
    logs['2026-09-25'] = activityLog('2026-09-25', target, [600]);
    const result = computeDailyLimit('2026-09-25', settings, logs);
    expect(result.limit).toEqual(
      computeDailyLimit('2026-09-25', settings, {}).limit,
    );
    expect(result.limit).toEqual(result.target);
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
