'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileCalculator } from './ProfileCalculator';
import { SportSettingsForm } from './SportSettingsForm';
import type { PFC, SportDefinition, UserProfile } from '@/lib/types';
import { saveSettings, saveSports } from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';
import { toast } from '@/lib/toast';

export function GoalSettingsPanel() {
  const { settings, sports: savedSports } = useAppState();
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [goals, setGoals] = useState<PFC>(settings.targetPFC);
  const [profile, setProfile] = useState<UserProfile | undefined>(settings.profile);
  const [sports, setSports] = useState<SportDefinition[]>(savedSports);

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

  const handleSaveGoals = async () => {
    if (await saveSettings({ ...settings, targetPFC: goals, profile })) {
      toast.success('目標設定を保存しました');
    }
  };

  const handleSaveSports = async () => {
    if (await saveSports(sports)) {
      toast.success('スポーツマスタを保存しました');
    }
  };

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
            <Button onClick={() => { void handleSaveGoals(); }}>目標設定を保存</Button>
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
            <Button onClick={() => { void handleSaveSports(); }}>スポーツマスタを保存</Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
