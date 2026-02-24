'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PFCStats } from '@/components/dashboard/PFCStats';
import { WeeklyPFCStats } from '@/components/dashboard/WeeklyPFCStats';
import { QuickAddButtons } from '@/components/dashboard/QuickAddButtons';
import { PfcDebtCharts } from '@/components/dashboard/PfcDebtCharts';
import { getTodayString } from '@/lib/storage';
import { format, parseISO, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import { PageTitle } from '@/components/ui/page-title';

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
  };

  const displayDate = parseISO(selectedDate);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <PageTitle>
          {isToday(displayDate)
            ? '今日のバランス'
            : `${format(displayDate, 'M月d日', { locale: ja })}のバランス`}
        </PageTitle>
      </div>

      <PFCStats selectedDate={selectedDate} onDateChange={handleDateChange} />

      <QuickAddButtons />

      <PfcDebtCharts referenceDate={selectedDate} />

      <WeeklyPFCStats />

      <div className="pb-4 text-right">
        <Link href="/privacy-policy" className="text-muted-foreground text-xs underline">
          プライバシーポリシー
        </Link>
      </div>
    </div>
  );
}
