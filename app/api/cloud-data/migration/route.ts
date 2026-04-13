import { NextRequest, NextResponse } from 'next/server';
import { getCloudData, setCloudData } from '@/lib/cloud-data';
import { getLegacyCloudData } from '@/lib/cloud-data-legacy';

interface MigrationRequest {
  syncKey?: unknown;
  force?: unknown;
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
      return NextResponse.json({ error: '同期キーが不正です' }, { status: 400 });
    }

    const [legacy, current] = await Promise.all([
      getLegacyCloudData(syncKey),
      getCloudData(syncKey),
    ]);

    return NextResponse.json({
      hasLegacyBackup: !!legacy,
      hasRdbData: !!current.payload,
      legacyUpdatedAt: legacy?.updatedAt ?? null,
      rdbUpdatedAt: current.updatedAt,
    });
  } catch (error) {
    console.error('移行チェックエラー', error);
    return NextResponse.json({ error: '移行チェックに失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MigrationRequest;
    const syncKey = normalizeSyncKey(body.syncKey);

    if (!isValidSyncKey(syncKey)) {
      return NextResponse.json({ error: '同期キーが不正です' }, { status: 400 });
    }

    const [legacy, current] = await Promise.all([
      getLegacyCloudData(syncKey),
      getCloudData(syncKey),
    ]);

    if (!legacy) {
      return NextResponse.json({ error: '移行対象の旧バックアップが見つかりません' }, { status: 404 });
    }

    const hasRdbData = !!current.payload;
    const force = body.force === true;

    if (hasRdbData && !force) {
      return NextResponse.json(
        { error: 'RDBに既存データがあります。上書きする場合はforce=trueで再実行してください。' },
        { status: 409 },
      );
    }

    await setCloudData(syncKey, legacy.payload, legacy.updatedAt);

    return NextResponse.json({
      ok: true,
      overwritten: hasRdbData,
      updatedAt: legacy.updatedAt,
    });
  } catch (error) {
    console.error('移行実行エラー', error);
    return NextResponse.json({ error: '移行に失敗しました' }, { status: 500 });
  }
}
