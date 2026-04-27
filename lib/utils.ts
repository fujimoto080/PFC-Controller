import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const JST_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatDate(date: Date | number | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return JST_FORMATTER.format(d);
}

export function roundPFC(value: number): number {
  return Math.round(value * 100) / 100;
}

export function generateId(): string {
  return crypto.randomUUID();
}
