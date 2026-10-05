/** @jest-environment node */
import { upsertHealthDaily } from '@/lib/server/health-daily';

const query = jest.fn<Promise<unknown>, [string, unknown[]?]>();
jest.mock('@/lib/server/db', () => ({
  transaction: (fn: (client: { query: typeof query }) => Promise<void>) =>
    fn({ query }),
}));
jest.mock('server-only', () => ({}));

beforeEach(() => query.mockReset());

describe('upsertHealthDaily', () => {
  it('送られた項目だけを渡し、未送信は null にして既存値を残す', async () => {
    await upsertHealthDaily('u1', '2026-10-05', { steps: 8000 });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, values] = query.mock.calls[0] ?? [];
    expect(sql).toContain('COALESCE(EXCLUDED.weight_kg');
    expect(values).toEqual(['u1', '2026-10-05', null, null, 8000]);
  });

  it('体重を送ったときは、最新の測定の場合に限ってプロフィールの体重を更新する', async () => {
    await upsertHealthDaily('u1', '2026-10-05', { weightKg: 68.4 });

    expect(query).toHaveBeenCalledTimes(2);
    const [sql, values] = query.mock.calls[1] ?? [];
    expect(sql).toContain("jsonb_set(profile_json, '{weight}'");
    expect(sql).toContain('date > $3::date');
    expect(values).toEqual(['u1', 68.4, '2026-10-05']);
  });
});
