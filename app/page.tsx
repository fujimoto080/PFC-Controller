'use client';

import { useState, useMemo, useCallback } from 'react';
import { PFCStats } from '@/components/dashboard/PFCStats';
import { WeeklyPFCStats } from '@/components/dashboard/WeeklyPFCStats';
import { WeeklyBalancingStats } from '@/components/dashboard/WeeklyBalancingStats';
import { getTodayString, getLogForDate, saveSettings } from '@/lib/storage';
import { format, parseISO, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import { GoalEditForm } from '@/components/settings/GoalEditForm';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { PFC, UserProfile } from '@/lib/types';
import { toast } from 'sonner';
import { usePfcData } from '@/hooks/use-pfc-data';

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const { settings } = usePfcData();

  const handleSaveGoals = useCallback((newGoals: PFC, newProfile?: UserProfile) => {
    if (!settings) return;
    const newSettings = { ...settings, targetPFC: newGoals, profile: newProfile };
    saveSettings(newSettings);
    toast.success('目標を更新しました');
  }, [settings]);
  const recentEntries = useMemo(() => {
    const log = getLogForDate(selectedDate);
    return log.items.slice().reverse(); // Newest first
  }, [selectedDate]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
  };

  const displayDate = parseISO(selectedDate);

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between py-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {isToday(displayDate)
            ? '今日のバランス'
            : `${format(displayDate, 'M月d日', { locale: ja })}のバランス`}
        </h1>
        <div className="flex items-center gap-2">
          {settings && (
            <GoalEditForm
              initialGoals={settings.targetPFC}
              initialProfile={settings.profile}
              onSave={handleSaveGoals}
              trigger={
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                </Button>
              }
            />
          )}
          <div className="bg-secondary h-8 w-8 rounded-full" />
        </div>
      </header>

      <PFCStats
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
      />
      <WeeklyBalancingStats />
      <WeeklyPFCStats />

      {/* Recent Entries */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          {isToday(displayDate) ? '最近の記録' : `${format(displayDate, 'M/d')}の記録`}
        </h2>
        {recentEntries.length > 0 ? (
          <div className="space-y-2">
            {recentEntries.map((item) => (
              <div key={item.id} className="flex justify-between items-center p-3 bg-secondary/10 rounded-lg border">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(item.timestamp), 'HH:mm')} • {item.calories} kcal
                  </div>
                </div>
                <div className="text-sm font-semibold">
                  P:{Math.round(item.protein * 100) / 100} F:{Math.round(item.fat * 100) / 100} C:{Math.round(item.carbs * 100) / 100}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground bg-secondary/20 rounded-lg border border-dashed py-10 text-center text-sm">
            {isToday(displayDate)
              ? '今日の記録はありません。「追加」ボタンから記録しましょう。'
              : 'この日の記録はありません。'}
          </div>
        )}
      </div>
    </div>
  );
}
