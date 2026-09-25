import {
  cn,
  defaultTimestampFor,
  formatDate,
  toJstTimestamp,
} from '@/lib/utils';

describe('cn', () => {
  it('should merge class names correctly', () => {
    expect(cn('c-1', 'c-2')).toBe('c-1 c-2');
  });

  it('should handle conditional classes', () => {
    expect(cn('c-1', { 'c-2': true, 'c-3': false })).toBe('c-1 c-2');
  });

  it('should merge tailwind classes using tailwind-merge', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});

describe('formatDate (JST fixed)', () => {
  it('returns YYYY-MM-DD for a Date instance in JST', () => {
    // 2026-04-25 12:00:00 JST == 2026-04-25 03:00:00 UTC
    const utc = Date.UTC(2026, 3, 25, 3, 0, 0);
    expect(formatDate(new Date(utc))).toBe('2026-04-25');
  });

  it('accepts a numeric (epoch ms) input', () => {
    const utc = Date.UTC(2026, 3, 25, 3, 0, 0);
    expect(formatDate(utc)).toBe('2026-04-25');
  });

  it('accepts an ISO string input', () => {
    expect(formatDate('2026-04-25T03:00:00.000Z')).toBe('2026-04-25');
  });

  it('does not roll over at UTC 14:59 (= JST 23:59 same day)', () => {
    // UTC 2026-04-25 14:59 == JST 2026-04-25 23:59
    const utc = Date.UTC(2026, 3, 25, 14, 59, 0);
    expect(formatDate(new Date(utc))).toBe('2026-04-25');
  });

  it('rolls over at UTC 15:00 (= JST 00:00 next day)', () => {
    // UTC 2026-04-25 15:00 == JST 2026-04-26 00:00
    const utc = Date.UTC(2026, 3, 25, 15, 0, 0);
    expect(formatDate(new Date(utc))).toBe('2026-04-26');
  });

  it('is stable regardless of process TZ (uses Asia/Tokyo)', () => {
    // At UTC midnight, in JST it is 09:00 of the same calendar day.
    const utc = Date.UTC(2026, 0, 1, 0, 0, 0);
    expect(formatDate(new Date(utc))).toBe('2026-01-01');
  });
});

describe('defaultTimestampFor', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('今日なら現在時刻、それ以外はその日の正午(JST)', () => {
    const now = toJstTimestamp('2026-09-25', '08:30');
    jest.useFakeTimers({ now });
    expect(defaultTimestampFor('2026-09-25')).toBe(now);
    expect(defaultTimestampFor('2026-09-24')).toBe(
      toJstTimestamp('2026-09-24', '12:00'),
    );
  });
});
