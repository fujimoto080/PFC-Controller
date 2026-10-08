import {
  DEFAULT_PROFILE,
  calculateBMR,
  calculateGoals,
  calculateRecommendedDuration,
  calculateTDEE,
  targetDuration,
} from '@/lib/nutrition-goals';
import type { UserProfile } from '@/lib/types';

const profile: UserProfile = { ...DEFAULT_PROFILE };

describe('calculateBMR / calculateTDEE', () => {
  it('Mifflin-St Jeor 式で計算する', () => {
    // 10*70 + 6.25*170 - 5*30 + 5 = 1617.5 → 1618
    expect(calculateBMR(profile)).toBe(1618);
    expect(calculateBMR({ ...profile, gender: 'female' })).toBe(1452);
    // 1618 * 1.375 = 2224.75 → 2225
    expect(calculateTDEE(profile)).toBe(2225);
  });
});

describe('calculateGoals', () => {
  it('減量時は期間に応じて1日の摂取カロリーを減らす', () => {
    // 5kg * 7200 / (3 * 30) = 400kcal/日
    const goals = calculateGoals(profile, 3);
    expect(goals.calorieAdjustment).toBe(-400);
    expect(goals.calories).toBe(1825);
    expect(goals).toMatchObject({ protein: 112, fat: 50.7, carbs: 230.2 });
  });

  it('増量時は加算する', () => {
    expect(
      calculateGoals({ ...profile, targetWeight: 75 }, 3).calorieAdjustment,
    ).toBe(400);
  });

  it('短期間の目標でも赤字を20%以内に抑える', () => {
    const goals = calculateGoals(profile, 0.5);
    expect(goals.calories).toBe(1780);
    expect(goals.calories).toBeGreaterThanOrEqual(goals.tdee * 0.8);
  });
  it('各プロフィールでPFCとカロリーの差が1kcal未満になる', () => {
    for (const gender of ['male', 'female'] as const) {
      for (const weight of [45, 70, 120]) {
        const goals = calculateGoals({ ...profile, gender, weight }, 3);
        expect(
          Math.abs(
            goals.protein * 4 +
              goals.fat * 9 +
              goals.carbs * 4 -
              goals.calories,
          ),
        ).toBeLessThan(1);
        expect(goals.calories).toBeGreaterThanOrEqual(goals.minimumCalories);
      }
    }
  });
});

describe('calculateRecommendedDuration', () => {
  it('5%ルールと赤字20%制限のうち長い方を推奨する', () => {
    // 5 / 3.5 = 1.43、36000 / (30 * 445) ≒ 2.7
    expect(calculateRecommendedDuration(profile)).toEqual({
      byWeightLoss: 1.4,
      byCalorieLimit: 2.7,
      recommended: 2.7,
    });
  });

  it('減量でなければ 0、目標期間は 3ヶ月', () => {
    const gain = { ...profile, targetWeight: 75 };
    expect(calculateRecommendedDuration(gain).recommended).toBe(0);
    expect(targetDuration(gain)).toBe(3);
  });
});
