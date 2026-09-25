'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileCalculator } from './ProfileCalculator';
import { SportSettingsForm } from './SportSettingsForm';
import type { SportDefinition, UserProfile } from '@/lib/types';
import { saveSettings, saveSports } from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';
import {
  DEFAULT_PROFILE,
  calculateGoals,
  initialDuration,
} from '@/lib/nutrition-goals';
import { toast } from '@/lib/toast';

export function GoalSettingsPanel() {
  const { settings, sports: savedSports } = useAppState();
  const [profile, setProfile] = useState<UserProfile>(
    settings.profile ?? DEFAULT_PROFILE,
  );
  const [duration, setDuration] = useState(() => initialDuration(profile));
  const [sports, setSports] = useState<SportDefinition[]>(savedSports);
  const goals = calculateGoals(profile, duration);

  const handleAddSport = (sport: SportDefinition) => {
    setSports((prev) => [...prev, sport]);
  };

  const handleDeleteSport = (id: string) => {
    setSports((prev) => prev.filter((sport) => sport.id !== id));
  };

  const handleSaveGoals = async () => {
    const { protein, fat, carbs, calories } = goals;
    const targetPFC = { protein, fat, carbs, calories };
    if (await saveSettings({ ...settings, targetPFC, profile })) {
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
            profile={profile}
            onProfileChange={setProfile}
            duration={duration}
            onDurationChange={setDuration}
            goals={goals}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => {
                void handleSaveGoals();
              }}
            >
              目標設定を保存
            </Button>
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
            <Button
              onClick={() => {
                void handleSaveSports();
              }}
            >
              スポーツマスタを保存
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
