'use client';

import { useState } from 'react';
import { AddFoodDrawer } from '@/components/record/AddFoodDrawer';
import { DateHeader } from '@/components/today/DateHeader';
import { DayLogList } from '@/components/today/DayLogList';
import { DaySummary } from '@/components/today/DaySummary';
import { FavoriteChips } from '@/components/today/FavoriteChips';
import { formatDate } from '@/lib/utils';

export default function TodayPage() {
  const [date, setDate] = useState(() => formatDate(Date.now()));
  const [isAdding, setIsAdding] = useState(false);

  const openAdd = () => {
    setIsAdding(true);
  };

  return (
    <div className="space-y-5">
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
