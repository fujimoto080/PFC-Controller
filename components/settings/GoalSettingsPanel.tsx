'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAutoSave } from '@/hooks/use-auto-save';
import { AutoSaveIndicator } from './AutoSaveIndicator';
import { ProfileCalculator } from './ProfileCalculator';
import type { UserProfile } from '@/lib/types';
import { updateSettings } from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';
import {
  DEFAULT_PROFILE,
  calculateGoals,
  targetDuration,
} from '@/lib/nutrition-goals';

export function GoalSettingsPanel() {
  const { settings } = useAppState();
  const [profile, setProfile] = useState<UserProfile>(
    settings.profile ?? DEFAULT_PROFILE,
  );
  const duration = targetDuration(profile);
  const goals = calculateGoals(profile, duration);
  const { protein, fat, carbs, calories } = goals;
  const targetPFC = { protein, fat, carbs, calories };
  // 数値欄を消して打ち直している途中（0 や空欄）は保存しない
  const valid =
    [profile.age, profile.height, profile.weight, profile.targetWeight].every(
      (n) => n > 0,
    ) &&
    Object.values(targetPFC).every((n) => Number.isFinite(n) && n >= 0);
  const status = useAutoSave({ targetPFC, profile }, updateSettings, valid);

  return (
    <Card>
      <CardHeader>
        <CardTitle>1日の上限</CardTitle>
        <AutoSaveIndicator status={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <ProfileCalculator
          profile={profile}
          onProfileChange={setProfile}
          duration={duration}
          goals={goals}
        />
      </CardContent>
    </Card>
  );
}
