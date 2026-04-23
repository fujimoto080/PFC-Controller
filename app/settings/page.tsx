'use client';

import { PageTitle } from '@/components/ui/page-title';
import { GoalSettingsPanel } from '@/components/settings/GoalSettingsPanel';
import { CloudSyncSettings } from '@/components/settings/CloudSyncSettings';

export default function SettingsPage() {
  return (
    <div className="space-y-6 pb-20">
      <PageTitle>設定</PageTitle>

      <CloudSyncSettings />

      <GoalSettingsPanel />
    </div>
  );
}
