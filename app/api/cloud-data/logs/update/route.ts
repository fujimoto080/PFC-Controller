import { NextRequest, NextResponse } from 'next/server';
import { updateCloudLogs } from '@/lib/cloud-data';
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
    await updateCloudLogs(syncKey, body.logs as Record<string, unknown>, updatedAt);

    return NextResponse.json({ ok: true, updatedAt, mode: 'update' });
  } catch (error) {
    console.error('クラウドログupdateエラー', error);
    return NextResponse.json({ error: 'クラウドログのupdateに失敗しました' }, { status: 500 });
  }
}
