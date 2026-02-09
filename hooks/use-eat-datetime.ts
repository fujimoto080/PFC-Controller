'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';

export function useEatDateTime() {
  const [eatDate, setEatDate] = useState('');
  const [eatTime, setEatTime] = useState('');

  useEffect(() => {
    // マウント時に日付と時刻を初期化（ハイドレーションエラーと同期的なsetStateの警告を回避）
    const now = new Date();
    const date = formatDate(now);
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    queueMicrotask(() => {
      if (!eatDate) setEatDate(date);
      if (!eatTime) setEatTime(time);
    });
  }, [eatDate, eatTime]);

  const getSelectedTimestamp = () => {
    const [year, month, day] = eatDate.split('-').map(Number);
    const [hour, minute] = eatTime.split(':').map(Number);
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
