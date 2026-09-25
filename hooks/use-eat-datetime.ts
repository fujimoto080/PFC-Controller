'use client';

import { useState } from 'react';
import { formatDate, formatTime, toJstTimestamp } from '@/lib/utils';

export interface EatDateTime {
  date: string; // YYYY-MM-DD (JST)
  time: string; // HH:mm (JST)
}

/**
 * 「食べた日付/時刻」の入力状態。省略時は現在時刻で初期化する。
 * 初期値はマウント時のみ反映されるため、対象を切り替える場合は key で再マウントする。
 */
export function useEatDateTime(initialTimestamp?: number) {
  const [value, setValue] = useState<EatDateTime>(() => {
    const timestamp = initialTimestamp ?? Date.now();
    return { date: formatDate(timestamp), time: formatTime(timestamp) };
  });

  return {
    value,
    onChange: setValue,
    timestamp: toJstTimestamp(value.date, value.time),
  };
}
