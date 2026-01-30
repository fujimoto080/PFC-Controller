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
