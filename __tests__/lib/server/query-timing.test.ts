/** @jest-environment node */
import {
  collectQueryTimings,
  formatServerTiming,
  timeQuery,
} from '@/lib/server/query-timing';

jest.mock('server-only', () => ({}));

describe('timeQuery / collectQueryTimings', () => {
  it('計測中に実行したクエリを SQL と所要時間つきで集める', async () => {
    const { result, timings } = await collectQueryTimings(async () => {
      await timeQuery('SELECT 1', () => Promise.resolve('a'));
      return timeQuery({ text: 'SELECT 2' }, () => Promise.resolve('b'));
    });
    expect(result).toBe('b');
    expect(timings.map((timing) => timing.sql)).toEqual([
      'SELECT 1',
      'SELECT 2',
    ]);
  });

  it('クエリが失敗しても所要時間を記録し、エラーはそのまま投げる', async () => {
    const { timings } = await collectQueryTimings(async () => {
      await expect(
        timeQuery('BAD', () => Promise.reject(new Error('boom'))),
      ).rejects.toThrow('boom');
    });
    expect(timings).toHaveLength(1);
  });

  it('計測中でなければそのまま実行する', async () => {
    await expect(
      timeQuery('SELECT 1', () => Promise.resolve('x')),
    ).resolves.toBe('x');
  });
});

describe('formatServerTiming', () => {
  it('クエリが無ければ total だけ', () => {
    expect(formatServerTiming(12.34, [])).toBe('total;dur=12.3');
  });

  it('db 合計と、遅い順のクエリごとの所要時間を出す', () => {
    const header = formatServerTiming(50, [
      { sql: 'SELECT a\n  FROM "t"', ms: 1 },
      { sql: 'SELECT b', ms: 3 },
    ]);
    expect(header).toBe(
      `total;dur=50.0, db;dur=4.0;desc="2 queries", q1;dur=3.0;desc="SELECT b", q2;dur=1.0;desc="SELECT a FROM 't'"`,
    );
  });
});
