'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveSettings, loadCloudData, clearCloudData } from '@/lib/storage';
import { toast } from '@/lib/toast';
import { usePfcData } from '@/hooks/use-pfc-data';

const MIN_SYNC_KEY_LENGTH = 8;

export function CloudSyncSettings() {
  const { settings } = usePfcData();
  const [syncKey, setSyncKey] = useState(settings?.cloudSyncKey || '');
  const [hasLegacyCloudData, setHasLegacyCloudData] = useState(false);
  const [hasRdbData, setHasRdbData] = useState(false);
  const [isCheckingMigration, setIsCheckingMigration] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const normalizedSyncKey = useMemo(() => syncKey.trim(), [syncKey]);

  const handleSave = async () => {
    if (!settings) return;

    if (!normalizedSyncKey) {
      clearCloudData();
      toast.success('クラウド同期キーを解除しました');
      return;
    }

    if (normalizedSyncKey.length < MIN_SYNC_KEY_LENGTH) {
      toast.error(`同期キーは${MIN_SYNC_KEY_LENGTH}文字以上で入力してください`);
      return;
    }

    setIsSaving(true);
    try {
      const ok = await loadCloudData(normalizedSyncKey);
      if (!ok) return;

      saveSettings({
        ...settings,
        cloudSyncKey: normalizedSyncKey,
      });
      toast.success('クラウド同期キーを保存しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckMigration = async () => {
    if (normalizedSyncKey.length < MIN_SYNC_KEY_LENGTH) {
      toast.error(`同期キーは${MIN_SYNC_KEY_LENGTH}文字以上で入力してください`);
      return;
    }

    setIsCheckingMigration(true);
    try {
      const response = await fetch(
        `/api/cloud-data/migration?syncKey=${encodeURIComponent(normalizedSyncKey)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '移行チェックに失敗しました');
      }

      setHasLegacyCloudData(!!data.hasLegacyCloudData);
      setHasRdbData(!!data.hasRdbData);

      if (!data.hasLegacyCloudData) {
        toast.info('移行対象の旧クラウドデータは見つかりませんでした');
        return;
      }

      if (data.hasRdbData) {
        toast.warning('RDBに既存データがあります。移行すると上書きされます');
        return;
      }

      toast.success('移行可能な旧クラウドデータが見つかりました');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '移行チェックに失敗しました');
    } finally {
      setIsCheckingMigration(false);
    }
  };

  const handleMigrateToRdb = async () => {
    if (!hasLegacyCloudData) {
      toast.warning('先に移行チェックを実行してください');
      return;
    }

    const force =
      hasRdbData &&
      window.confirm('RDBに既存データがあります。旧クラウドデータで上書きしますか？');

    if (hasRdbData && !force) {
      return;
    }

    setIsMigrating(true);
    try {
      const response = await fetch('/api/cloud-data/migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncKey: normalizedSyncKey, force }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '移行に失敗しました');
      }

      setHasRdbData(true);
      toast.success('旧クラウドデータをRDBへ移行しました');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '移行に失敗しました');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>クラウド同期</CardTitle>
        <CardDescription>
          同期キーを同じ値にした端末同士で、摂取履歴などのデータを共有できます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="cloud-sync-key">同期キー</Label>
          <Input
            id="cloud-sync-key"
            value={syncKey}
            onChange={(event) => {
              setSyncKey(event.target.value);
              setHasLegacyCloudData(false);
              setHasRdbData(false);
            }}
            placeholder="8文字以上で入力"
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={handleCheckMigration} variant="secondary" disabled={isCheckingMigration}>
            {isCheckingMigration ? '確認中...' : '旧クラウドデータを確認'}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? '保存中...' : '同期キーを保存'}
          </Button>
        </div>
        {hasLegacyCloudData && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm">
              旧クラウドデータが見つかりました。{hasRdbData && 'RDBの既存データは上書きされます。'}
            </p>
            <Button onClick={handleMigrateToRdb} disabled={isMigrating} className="w-full">
              {isMigrating ? '移行中...' : '旧クラウドデータをRDBに移行'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
