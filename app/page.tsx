'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { PFCStats } from '@/components/dashboard/PFCStats';
import { WeeklyPFCStats } from '@/components/dashboard/WeeklyPFCStats';
import { QuickAddButtons } from '@/components/dashboard/QuickAddButtons';
import { PfcDebtCharts } from '@/components/dashboard/PfcDebtCharts';
import { getTodayString, saveSettings } from '@/lib/storage';
import { format, parseISO, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import { GoalEditForm } from '@/components/settings/GoalEditForm';
import { IconButton } from '@/components/ui/icon-button';
import { Settings } from 'lucide-react';
import { PFC, UserProfile } from '@/lib/types';
import { toast } from '@/lib/toast';
import { usePfcData } from '@/hooks/use-pfc-data';
import { PageTitle } from '@/components/ui/page-title';

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const { settings } = usePfcData();

  const handleSaveGoals = useCallback((newGoals: PFC, newProfile?: UserProfile) => {
    if (!settings) return;
    const newSettings = { ...settings, targetPFC: newGoals, profile: newProfile };
    saveSettings(newSettings);
    toast.success('目標を更新しました');
  }, [settings]);

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
        {settings && (
          <GoalEditForm
            initialGoals={settings.targetPFC}
            initialProfile={settings.profile}
            onSave={handleSaveGoals}
            trigger={
              <IconButton className="rounded-full mr-4">
                <Settings className="h-5 w-5 text-muted-foreground" />
              </IconButton>
            }
          />
        )}
      </div>

      <PFCStats
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
      />

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
