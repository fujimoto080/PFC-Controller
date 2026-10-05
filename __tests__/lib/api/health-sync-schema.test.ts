import { healthSyncSchema } from '@/lib/api/schemas';

const base = { email: 'a@example.com', date: '2026-10-05' };

describe('healthSyncSchema', () => {
  it('どれか 1 項目があれば通る', () => {
    expect(healthSyncSchema.safeParse({ ...base, steps: 100 }).success).toBe(
      true,
    );
    expect(
      healthSyncSchema.safeParse({ ...base, caloriesBurned: 0 }).success,
    ).toBe(true);
  });

  it('同期する項目が 1 つも無ければ弾く', () => {
    expect(healthSyncSchema.safeParse(base).success).toBe(false);
  });

  it('体脂肪率は 100 以下、体重は正の数', () => {
    expect(
      healthSyncSchema.safeParse({ ...base, bodyFatPercent: 101 }).success,
    ).toBe(false);
    expect(healthSyncSchema.safeParse({ ...base, weightKg: 0 }).success).toBe(
      false,
    );
  });
});
