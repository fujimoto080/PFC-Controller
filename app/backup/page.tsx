'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageTitle } from '@/components/ui/page-title';
import { createBackupPayload, restoreBackupPayload } from '@/lib/storage';
import { createQrCodeUrl, normalizeBackupId } from '@/lib/backup';
import { toast } from '@/lib/toast';

export default function BackupPage() {
  const [backupLink, setBackupLink] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [inputBackupId, setInputBackupId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const id = url.searchParams.get('id');
    if (id) {
      setInputBackupId(id);
    }
  }, []);
  const qrCodeUrl = useMemo(() => {
    if (!backupLink) return '';
    return createQrCodeUrl(backupLink);
  }, [backupLink]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const payload = createBackupPayload();
      const response = await fetch('/api/backup/temp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'バックアップ作成に失敗しました');
      }

      const link = `${window.location.origin}/backup?id=${data.backupId}`;
      setBackupLink(link);
      setInputBackupId(data.backupId);
      setExpiresAt(data.expiresAt);
      toast.success('クラウドバックアップを作成しました');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'バックアップ作成に失敗しました',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async () => {
    const backupId = normalizeBackupId(inputBackupId);
    if (!backupId) {
      toast.warning('バックアップIDを入力してください');
      return;
    }

    setIsRestoring(true);
    try {
      const response = await fetch(`/api/backup/temp/${backupId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'バックアップの取得に失敗しました');
      }

      const ok = restoreBackupPayload(data.payload);
      if (!ok) {
        throw new Error('バックアップ形式が不正です');
      }

      toast.success('バックアップを復元しました');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'バックアップ復元に失敗しました',
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const expiryText = expiresAt
    ? new Date(expiresAt).toLocaleString('ja-JP')
    : null;

  return (
    <div className="space-y-4 pb-24">
      <PageTitle>クラウド一時バックアップ</PageTitle>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">バックアップを作成</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            現在のログ・設定・食品データをクラウドに一時保存します。データは作成から24時間後に自動削除され、期間内は何度でも復元できます。
          </p>
          <Button
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full"
          >
            {isCreating ? '作成中...' : 'クラウドにバックアップ'}
          </Button>

          {backupLink && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1">
                <Label htmlFor="backup-link">復元リンク</Label>
                <Input id="backup-link" value={backupLink} readOnly />
              </div>
              {expiryText && (
                <p className="text-muted-foreground text-xs">
                  有効期限: {expiryText}
                </p>
              )}
              {qrCodeUrl && (
                <div className="flex justify-center">
                  <Image
                    src={qrCodeUrl}
                    alt="バックアップ復元QRコード"
                    width={176}
                    height={176}
                    className="h-44 w-44 rounded-md border"
                    unoptimized
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">バックアップを復元</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="backup-id">バックアップID</Label>
            <Input
              id="backup-id"
              value={inputBackupId}
              onChange={(event) => setInputBackupId(event.target.value)}
              placeholder="リンク内のIDを入力"
            />
          </div>
          <Button
            onClick={handleRestore}
            disabled={isRestoring}
            className="w-full"
            variant="secondary"
          >
            {isRestoring ? '復元中...' : 'この端末に復元'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
