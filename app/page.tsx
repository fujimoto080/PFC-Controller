'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { RecordStep } from '@/components/record/RecordDrawer';
import { DayActivityList } from '@/components/today/DayActivityList';
import { DateHeader } from '@/components/today/DateHeader';
import { DayLogList } from '@/components/today/DayLogList';
import { DaySummary } from '@/components/today/DaySummary';
import { FavoriteChips } from '@/components/today/FavoriteChips';
import { QuickAiInput } from '@/components/today/QuickAiInput';
import { useDaySwipe } from '@/hooks/use-day-swipe';
import { useEverOpen } from '@/hooks/use-ever-open';
import { formatDate, shiftDate } from '@/lib/utils';

// 食品の追加シートは重いため、初めて開くまで読み込まない
const AddFoodDrawer = dynamic(() =>
  import('@/components/record/AddFoodDrawer').then((m) => m.AddFoodDrawer),
);

export default function TodayPage() {
  const [date, setDate] = useState(() => formatDate(Date.now()));
  // 追加シートを開いているときは、最初に出す画面（未指定なら検索）を持つ
  const [adding, setAdding] = useState<{ step?: RecordStep } | null>(null);

  const { contentRef, handlers } = useDaySwipe(date, (days) => {
    setDate((current) => shiftDate(current, days));
  });

  const addMounted = useEverOpen(adding !== null);

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
          onAdd={openAdd}
          onEstimated={(food, photos) => {
            setAdding({ step: { food, photos } });
          }}
        />
        <FavoriteChips
          onSelect={(food) => {
            setAdding({ step: { food } });
          }}
        />
        <DayLogList date={date} onAdd={openAdd} />
        <DayActivityList date={date} />
      </div>
      {addMounted && (
        <AddFoodDrawer
          open={adding !== null}
          date={date}
          initialStep={adding?.step}
          onClose={() => {
            setAdding(null);
          }}
        />
      )}
    </div>
  );
}
