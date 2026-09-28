'use client';

import { useState } from 'react';
import { AddFoodDrawer } from '@/components/record/AddFoodDrawer';
import type { RecordStep } from '@/components/record/RecordDrawer';
import { DayActivityList } from '@/components/today/DayActivityList';
import { DateHeader } from '@/components/today/DateHeader';
import { DayLogList } from '@/components/today/DayLogList';
import { DaySummary } from '@/components/today/DaySummary';
import { FavoriteChips } from '@/components/today/FavoriteChips';
import { QuickAiInput } from '@/components/today/QuickAiInput';
import { useDaySwipe } from '@/hooks/use-day-swipe';
import { formatDate, shiftDate } from '@/lib/utils';

export default function TodayPage() {
  const [date, setDate] = useState(() => formatDate(Date.now()));
  // 追加シートを開いているときは、最初に出す画面（未指定なら検索）を持つ
  const [adding, setAdding] = useState<{ step?: RecordStep } | null>(null);

  const { contentRef, handlers } = useDaySwipe(date, (days) => {
    setDate((current) => shiftDate(current, days));
  });

  const openAdd = () => {
    setAdding({});
  };

  return (
    // スライド中に横スクロールが出ないよう切り取る
    <div className="overflow-x-clip" {...handlers}>
      <div ref={contentRef} className="space-y-5">
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
      </div>
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
