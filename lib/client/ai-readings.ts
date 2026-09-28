'use client';

import { useSyncExternalStore } from 'react';
import type { ImageReadingFood } from '@/lib/barcode';

// 写真の AI 読み取りがうまくいかないとき、送った画像と AI の応答を見て原因を確かめられるよう直近の分を残す。
// 画像が大きいため保存はせずメモリにだけ持つ。

const LIMIT = 10;

export interface AiReading {
  id: string;
  at: number;
  /** 送った画像（dataURL） */
  image: string;
  /** AI の応答テキスト。通信・AI の呼び出しに失敗した場合は無い */
  response?: string;
  /** 応答から読み取れた食品と確かさ */
  foods: ImageReadingFood[];
  /** 失敗したときのメッセージ */
  error?: string;
}

let readings: AiReading[] = [];
const listeners = new Set<() => void>();
const EMPTY: AiReading[] = [];

export function recordAiReading(reading: Omit<AiReading, 'id' | 'at'>) {
  readings = [
    { ...reading, id: crypto.randomUUID(), at: Date.now() },
    ...readings,
  ].slice(0, LIMIT);
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 直近の写真の読み取り。新しい順。 */
export function useAiReadings(): AiReading[] {
  return useSyncExternalStore(
    subscribe,
    () => readings,
    () => EMPTY,
  );
}
