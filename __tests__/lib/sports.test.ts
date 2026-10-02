import { buildSportActivity, calculateSportCalories } from '@/lib/sports';

describe('calculateSportCalories', () => {
  it('METs × 強度係数 × 体重 × 時間 × 1.05 で求める', () => {
    // 8 * 1 * 60 * 0.5 * 1.05 = 252
    expect(
      calculateSportCalories({
        mets: 8,
        intensity: 'normal',
        minutes: 30,
        weight: 60,
      }),
    ).toBe(252);
    // 強度「きつめ」は 1.25 倍、「軽め」は 0.75 倍
    expect(
      calculateSportCalories({
        mets: 8,
        intensity: 'hard',
        minutes: 30,
        weight: 60,
      }),
    ).toBe(315);
    expect(
      calculateSportCalories({
        mets: 8,
        intensity: 'light',
        minutes: 30,
        weight: 60,
      }),
    ).toBe(189);
  });
});

describe('buildSportActivity', () => {
  it('時間と強度を名前に入れ、消費カロリーを計算した記録を作る', () => {
    expect(
      buildSportActivity(
        { id: 'swim', name: '水泳', mets: 8 },
        { intensity: 'normal', minutes: 30, weight: 60, timestamp: 1000 },
      ),
    ).toEqual({
      sportId: 'swim',
      name: '水泳 30分（普通）',
      caloriesBurned: 252,
      timestamp: 1000,
    });
  });
});
