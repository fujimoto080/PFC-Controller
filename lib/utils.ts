import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | number | string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function roundPFC(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getPFCPercentage(current: number, target: number): number {
  if (target === 0) return 0;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

export function generateId(): string {
  return Date.now().toString();
}

/**
 * タイムスタンプから時間帯を判定する
 * @param timestamp - Unix timestamp (ミリ秒)
 * @returns 'morning' | 'afternoon' | 'evening' | 'night'
 */
export function getTimeOfDay(timestamp: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date(timestamp).getHours();

  if (hour >= 5 && hour < 11) return 'morning';      // 朝: 5:00-10:59
  if (hour >= 11 && hour < 15) return 'afternoon';   // 昼: 11:00-14:59
  if (hour >= 15 && hour < 18) return 'evening';     // 夕方: 15:00-17:59
  return 'night';                                     // 夜: 18:00-4:59
}

const timeOfDayGradientMap: Record<ReturnType<typeof getTimeOfDay>, string> = {
  morning:
    'bg-[linear-gradient(80deg,rgba(255,120,80,0.45)_0%,rgba(255,180,150,0.25)_5%,transparent_10%)]',
  afternoon:
    'bg-[linear-gradient(80deg,rgba(80,160,255,0.45)_0%,rgba(150,210,255,0.25)_5%,transparent_10%)]',
  evening:
    'bg-[linear-gradient(80deg,rgba(255,90,120,0.45)_0%,rgba(200,120,255,0.25)_5%,transparent_10%)]',
  night:
    'bg-[linear-gradient(80deg,rgba(80,90,255,0.45)_0%,rgba(120,100,200,0.25)_5%,transparent_10%)]',
};

/**
 * 時間帯に応じたグラデーション背景のクラス名を返す
 * @param timestamp - Unix timestamp (ミリ秒)
 * @returns Tailwind CSS クラス名
 */
export function getTimeOfDayGradient(timestamp: number): string {
  const timeOfDay = getTimeOfDay(timestamp);

  return timeOfDayGradientMap[timeOfDay];
}
