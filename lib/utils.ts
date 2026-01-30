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

/**
 * 時間帯に応じたグラデーション背景のクラス名を返す
 * @param timestamp - Unix timestamp (ミリ秒)
 * @returns Tailwind CSS クラス名
 */
export function getTimeOfDayGradient(timestamp: number): string {
  const timeOfDay = getTimeOfDay(timestamp);
  
  switch (timeOfDay) {
    case 'morning':
      return 'bg-gradient-to-br from-amber-50/30 via-orange-50/20 to-yellow-50/30';
    case 'afternoon':
      return 'bg-gradient-to-br from-sky-50/30 via-blue-50/20 to-cyan-50/30';
    case 'evening':
      return 'bg-gradient-to-br from-orange-50/30 via-pink-50/20 to-rose-50/30';
    case 'night':
      return 'bg-gradient-to-br from-indigo-50/30 via-purple-50/20 to-blue-50/30';
  }
}
