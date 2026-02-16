import { NextResponse } from 'next/server';
import { getCloudBackup } from '@/lib/backup-cloud';
import { isBackupPayload, normalizeBackupId } from '@/lib/backup';

interface RouteParams {
  params: Promise<{ backupId: string }>;
}

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const { backupId } = await params;
    const normalizedBackupId = normalizeBackupId(backupId);

    if (!normalizedBackupId) {
      return NextResponse.json(
        { error: 'バックアップIDが必要です' },
        { status: 400 },
      );
    }

    const payload = await getCloudBackup(normalizedBackupId);

    if (!payload || !isBackupPayload(payload)) {
      return NextResponse.json(
        { error: 'バックアップが見つかりませんでした' },
        { status: 404 },
      );
    }

    return NextResponse.json({ payload });
  } catch (error) {
    console.error('バックアップ取得エラー', error);
    return NextResponse.json(
      { error: 'バックアップの取得に失敗しました' },
      { status: 500 },
    );
  }
}
