'use client';

import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { AddFoodDrawer } from '@/components/record/AddFoodDrawer';
import type { RecordStep } from '@/components/record/RecordDrawer';
import { DayActivityList } from '@/components/today/DayActivityList';
import { DateHeader } from '@/components/today/DateHeader';
import { DayLogList } from '@/components/today/DayLogList';
import { DaySummary } from '@/components/today/DaySummary';
import { FavoriteChips } from '@/components/today/FavoriteChips';
import { QuickAiInput } from '@/components/today/QuickAiInput';
import { formatDate, shiftDate } from '@/lib/utils';

export default function TodayPage() {
  const [date, setDate] = useState(() => formatDate(Date.now()));
  // 追加シートを開いているときは、最初に出す画面（未指定なら検索）を持つ
  const [adding, setAdding] = useState<{ step?: RecordStep } | null>(null);

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
    setAdding({});
  };

  return (
    <div className="space-y-5" {...swipeHandlers}>
      <DateHeader date={date} onChange={setDate} />
      <DaySummary date={date} />
      <QuickAiInput
        onEstimated={(food) => {
          setAdding({ step: { kind: 'confirm', food } });
        }}
      />
      <FavoriteChips date={date} />
      <DayLogList date={date} onAdd={openAdd} />
      <DayActivityList date={date} />
      <AddFoodDrawer
        open={adding !== null}
        date={date}
        initialStep={adding?.step}
        onClose={() => {
          setAdding(null);
        }}
      />
    </div>
  );
}
