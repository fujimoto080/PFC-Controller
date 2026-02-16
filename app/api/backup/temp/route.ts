import { NextRequest, NextResponse } from 'next/server';
import { createCloudBackup } from '@/lib/backup-cloud';
import { isBackupPayload } from '@/lib/backup';

interface CreateBackupRequest {
  payload?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateBackupRequest;

    if (!isBackupPayload(body.payload)) {
      return NextResponse.json(
        { error: 'バックアップデータの形式が不正です' },
        { status: 400 },
      );
    }

    const { backupId, expiresAt } = await createCloudBackup(body.payload);

    return NextResponse.json({ backupId, expiresAt });
  } catch (error) {
    console.error('バックアップ作成エラー', error);
    return NextResponse.json(
      { error: 'バックアップの作成に失敗しました' },
      { status: 500 },
    );
  }
}
