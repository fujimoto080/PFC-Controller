'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/ui/page-title';
import { GoalSettingsPanel } from '@/components/settings/GoalSettingsPanel';
import { CloudSyncSettings } from '@/components/settings/CloudSyncSettings';

export default function SettingsPage() {
  return (
    <div className="space-y-6 pb-20">
      <PageTitle>設定</PageTitle>

      <Card>
        <CardHeader>
          <CardTitle>バックアップ</CardTitle>
          <CardDescription>クラウド一時バックアップの作成と復元を行います。</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/backup" className="text-primary text-sm underline">
            バックアップページを開く
          </Link>
        </CardContent>
      </Card>

      <CloudSyncSettings />

      <GoalSettingsPanel />
    </div>
  );
}
