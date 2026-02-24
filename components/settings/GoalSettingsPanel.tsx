'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileCalculator } from './ProfileCalculator';
import { SportSettingsForm } from './SportSettingsForm';
import { PFC, SportDefinition, UserProfile } from '@/lib/types';
import { saveSettings } from '@/lib/storage';
import { toast } from '@/lib/toast';
import { usePfcData } from '@/hooks/use-pfc-data';

export function GoalSettingsPanel() {
  const { settings } = usePfcData();
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [goals, setGoals] = useState<PFC | null>(settings?.targetPFC ?? null);
  const [profile, setProfile] = useState<UserProfile | undefined>(settings?.profile);
  const [sports, setSports] = useState<SportDefinition[]>(settings?.sports || []);

  const handleCalculate = useCallback((newGoals: PFC, newProfile: UserProfile) => {
    setGoals(newGoals);
    setProfile(newProfile);
  }, []);

  const handleAddSport = (sport: SportDefinition) => {
    setSports((prev) => [...prev, sport]);
  };

  const handleDeleteSport = (id: string) => {
    setSports((prev) => prev.filter((sport) => sport.id !== id));
  };

  const handleSaveGoals = () => {
    if (!settings || !goals) return;
    saveSettings({
      ...settings,
      targetPFC: goals,
      profile,
      sports,
    });
    toast.success('目標設定を保存しました');
  };

  const handleSaveSports = () => {
    if (!settings) return;
    saveSettings({
      ...settings,
      sports,
    });
    toast.success('スポーツマスタを保存しました');
  };

  if (!settings || !goals) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>目標設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProfileCalculator
            initialProfile={profile}
            onCalculate={handleCalculate}
            duration={duration}
            onDurationChange={setDuration}
          />
          <div className="flex justify-end">
            <Button onClick={handleSaveGoals}>目標設定を保存</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>スポーツマスタ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SportSettingsForm
            sports={sports}
            onAddSport={handleAddSport}
            onDeleteSport={handleDeleteSport}
          />
          <div className="flex justify-end">
            <Button onClick={handleSaveSports}>スポーツマスタを保存</Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
