import { NextRequest, NextResponse } from 'next/server';
import { insertCloudSports } from '@/lib/cloud-data';
import {
  invalidSyncKeyResponse,
  isValidSyncKey,
  normalizeSyncKey,
  parseUpdatedAt,
} from '@/lib/cloud-sync-api';

interface SportsRequest {
  sports?: unknown;
  updatedAt?: unknown;
  syncKey?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SportsRequest;
    const syncKey = normalizeSyncKey(body.syncKey);

    if (!isValidSyncKey(syncKey)) {
      return invalidSyncKeyResponse();
    }

    if (!Array.isArray(body.sports)) {
      return NextResponse.json({ error: 'sports の形式が不正です' }, { status: 400 });
    }

    const updatedAt = parseUpdatedAt(body.updatedAt);
    await insertCloudSports(syncKey, body.sports, updatedAt);

    return NextResponse.json({ ok: true, updatedAt, mode: 'insert' });
  } catch (error) {
    console.error('クラウド運動辞書insertエラー', error);
    return NextResponse.json({ error: 'クラウド運動辞書のinsertに失敗しました' }, { status: 500 });
  }
}
