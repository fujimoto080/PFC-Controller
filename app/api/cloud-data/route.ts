import { NextRequest, NextResponse } from 'next/server';
import { getCloudData, setCloudData } from '@/lib/cloud-data';
import { isBackupPayload } from '@/lib/backup';

interface CloudDataRequest {
  payload?: unknown;
  updatedAt?: unknown;
  syncKey?: unknown;
}

function normalizeSyncKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidSyncKey(syncKey: string): boolean {
  return syncKey.length >= 8;
}

export async function GET(request: NextRequest) {
  try {
    const syncKey = normalizeSyncKey(request.nextUrl.searchParams.get('syncKey'));
    if (!isValidSyncKey(syncKey)) {
      return NextResponse.json(
        { error: '同期キーが不正です' },
        { status: 400 },
      );
    }

    const { payload, updatedAt } = await getCloudData(syncKey);
    return NextResponse.json({ payload, updatedAt });
  } catch (error) {
    console.error('クラウドデータ取得エラー', error);
    return NextResponse.json(
      { error: 'クラウドデータの取得に失敗しました' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CloudDataRequest;

    if (!isBackupPayload(body.payload)) {
      return NextResponse.json(
        { error: 'クラウドデータの形式が不正です' },
        { status: 400 },
      );
    }

    const syncKey = normalizeSyncKey(body.syncKey);
    if (!isValidSyncKey(syncKey)) {
      return NextResponse.json(
        { error: '同期キーが不正です' },
        { status: 400 },
      );
    }

    const updatedAt =
      typeof body.updatedAt === 'number' && Number.isFinite(body.updatedAt)
        ? body.updatedAt
        : Date.now();

    await setCloudData(syncKey, body.payload, updatedAt);

    return NextResponse.json({ ok: true, updatedAt });
  } catch (error) {
    console.error('クラウドデータ保存エラー', error);
    return NextResponse.json(
      { error: 'クラウドデータの保存に失敗しました' },
      { status: 500 },
    );
  }
}
