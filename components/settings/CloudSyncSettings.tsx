'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveSettings } from '@/lib/storage';
import { toast } from '@/lib/toast';
import { usePfcData } from '@/hooks/use-pfc-data';

const MIN_SYNC_KEY_LENGTH = 8;

export function CloudSyncSettings() {
  const { settings } = usePfcData();
  const [syncKey, setSyncKey] = useState(settings?.cloudSyncKey || '');

  const handleSave = () => {
    if (!settings) return;

    const normalizedKey = syncKey.trim();
    if (normalizedKey && normalizedKey.length < MIN_SYNC_KEY_LENGTH) {
      toast.error(`同期キーは${MIN_SYNC_KEY_LENGTH}文字以上で入力してください`);
      return;
    }

    saveSettings({
      ...settings,
      cloudSyncKey: normalizedKey || undefined,
    });
    toast.success('クラウド同期キーを保存しました');
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
            onChange={(event) => setSyncKey(event.target.value)}
            placeholder="8文字以上で入力"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave}>同期キーを保存</Button>
        </div>
      </CardContent>
    </Card>
  );
}
