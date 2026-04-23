import { NextRequest, NextResponse } from 'next/server';
import { setCloudLogs } from '@/lib/cloud-data';
import {
  invalidSyncKeyResponse,
  isValidSyncKey,
  normalizeSyncKey,
  parseUpdatedAt,
} from '@/lib/cloud-sync-api';

interface LogsRequest {
  logs?: unknown;
  updatedAt?: unknown;
  syncKey?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LogsRequest;
    const syncKey = normalizeSyncKey(body.syncKey);

    if (!isValidSyncKey(syncKey)) {
      return invalidSyncKeyResponse();
    }

    if (!body.logs || typeof body.logs !== 'object' || Array.isArray(body.logs)) {
      return NextResponse.json({ error: 'logs の形式が不正です' }, { status: 400 });
    }

    const updatedAt = parseUpdatedAt(body.updatedAt);
    await setCloudLogs(syncKey, body.logs as Record<string, unknown>, updatedAt);

    return NextResponse.json({ ok: true, updatedAt });
  } catch (error) {
    console.error('クラウドログ保存エラー', error);
    return NextResponse.json(
      { error: 'クラウドログの保存に失敗しました' },
      { status: 500 },
    );
  }
}
