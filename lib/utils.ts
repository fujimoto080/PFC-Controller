import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const JST_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const JST_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tokyo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** JST の日付文字列(YYYY-MM-DD)を返す。 */
export function formatDate(date: Date | number | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return JST_DATE_FORMATTER.format(d);
}

/** JST の時刻文字列(HH:mm)を返す。 */
export function formatTime(timestamp: number): string {
  return JST_TIME_FORMATTER.format(timestamp);
}

/** JST の日付(YYYY-MM-DD)と時刻(HH:mm)からタイムスタンプを作る。 */
export function toJstTimestamp(date: string, time = '00:00'): number {
  return new Date(`${date}T${time}:00+09:00`).getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** JST の日付文字列に日数を加算する。JST は夏時間が無いため固定長で加算できる。 */
export function shiftDate(date: string, days: number): string {
  return formatDate(toJstTimestamp(date) + days * DAY_MS);
}

export function roundPFC(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 配列に値があれば取り除き、なければ末尾に追加した新しい配列を返す。 */
export function toggleItem<T>(list: readonly T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}
