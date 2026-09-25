'use client';

import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { AddFoodDrawer } from '@/components/record/AddFoodDrawer';
import { DateHeader } from '@/components/today/DateHeader';
import { DayLogList } from '@/components/today/DayLogList';
import { DaySummary } from '@/components/today/DaySummary';
import { FavoriteChips } from '@/components/today/FavoriteChips';
import { formatDate, shiftDate } from '@/lib/utils';

export default function TodayPage() {
  const [date, setDate] = useState(() => formatDate(Date.now()));
  const [isAdding, setIsAdding] = useState(false);

  // 左スワイプで翌日、右スワイプで前日。横スクロール領域内のスワイプは無視する
  const swipeHandlers = useSwipeable({
    delta: 50,
    onSwiped: ({ dir, event }) => {
      if (dir !== 'Left' && dir !== 'Right') return;
      if ((event.target as Element).closest('[data-swipe-ignore]')) return;
      setDate((current) => shiftDate(current, dir === 'Left' ? 1 : -1));
    },
  });

  const openAdd = () => {
    setIsAdding(true);
  };

  return (
    <div className="space-y-5" {...swipeHandlers}>
      <DateHeader date={date} onChange={setDate} />
      <DaySummary date={date} />
      <FavoriteChips date={date} />
      <DayLogList date={date} onAdd={openAdd} />
      <AddFoodDrawer
        open={isAdding}
        date={date}
        onClose={() => {
          setIsAdding(false);
        }}
      />
    </div>
  );
}
