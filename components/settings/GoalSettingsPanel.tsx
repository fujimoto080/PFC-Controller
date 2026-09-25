'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileCalculator } from './ProfileCalculator';
import type { UserProfile } from '@/lib/types';
import { saveSettings } from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';
import {
  DEFAULT_PROFILE,
  calculateGoals,
  initialDuration,
} from '@/lib/nutrition-goals';
import { toast } from '@/lib/toast';

export function GoalSettingsPanel() {
  const { settings } = useAppState();
  const [profile, setProfile] = useState<UserProfile>(
    settings.profile ?? DEFAULT_PROFILE,
  );
  const [duration, setDuration] = useState(() => initialDuration(profile));
  const goals = calculateGoals(profile, duration);

  const handleSaveGoals = async () => {
    const { protein, fat, carbs, calories } = goals;
    const targetPFC = { protein, fat, carbs, calories };
    if (await saveSettings({ ...settings, targetPFC, profile })) {
      toast.success('1日の上限を保存しました');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>1日の上限</CardTitle>
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
            上限を保存
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
