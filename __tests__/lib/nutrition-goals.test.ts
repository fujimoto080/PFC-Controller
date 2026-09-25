import {
  DEFAULT_PROFILE,
  calculateBMR,
  calculateGoals,
  calculateRecommendedDuration,
  calculateTDEE,
  initialDuration,
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
    expect(goals).toMatchObject({ protein: 114, fat: 51, carbs: 228 });
  });

  it('増量時は加算する', () => {
    expect(
      calculateGoals({ ...profile, targetWeight: 75 }, 3).calorieAdjustment,
    ).toBe(400);
  });

  it('最低カロリーを下回らない', () => {
    const goals = calculateGoals(profile, 0.5);
    expect(goals.caloriesBeforeLimit).toBeLessThan(1500);
    expect(goals.calories).toBe(1500);
  });
});

describe('calculateRecommendedDuration', () => {
  it('5%ルールと最低カロリーのうち長い方を推奨する', () => {
    // 5 / 3.5 = 1.43, 36000 / (30 * 725) = 1.66
    expect(calculateRecommendedDuration(profile)).toEqual({
      byWeightLoss: 1.4,
      byCalorieLimit: 1.7,
      recommended: 1.7,
    });
  });

  it('減量でなければ 0、初期期間は 3ヶ月', () => {
    const gain = { ...profile, targetWeight: 75 };
    expect(calculateRecommendedDuration(gain).recommended).toBe(0);
    expect(initialDuration(gain)).toBe(3);
  });
});
