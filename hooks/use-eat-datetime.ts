'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';

/**
 * 「食べた日付/時刻」の state を管理する。
 * @param initialTimestamp 省略時は現在時刻で初期化。指定するとその値に同期し、
 *   値が変わるたび（編集対象の切り替えなど）再初期化する。
 */
export function useEatDateTime(initialTimestamp?: number) {
  const [eatDate, setEatDate] = useState('');
  const [eatTime, setEatTime] = useState('');

  useEffect(() => {
    // 同期的な setState の警告 / ハイドレーションずれを避けるため queueMicrotask で反映
    const base = initialTimestamp !== undefined ? new Date(initialTimestamp) : new Date();
    const date = formatDate(base);
    const time = `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`;

    queueMicrotask(() => {
      setEatDate(date);
      setEatTime(time);
    });
  }, [initialTimestamp]);

  const getSelectedTimestamp = () => {
    const [year = 0, month = 1, day = 1] = eatDate.split('-').map(Number);
    const [hour = 0, minute = 0] = eatTime.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute).getTime();
  };

  return {
    eatDate,
    setEatDate,
    eatTime,
    setEatTime,
    getSelectedTimestamp,
  };
}
