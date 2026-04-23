import { NextRequest, NextResponse } from 'next/server';
import { setCloudSports } from '@/lib/cloud-data';
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
    await setCloudSports(syncKey, body.sports, updatedAt);

    return NextResponse.json({ ok: true, updatedAt });
  } catch (error) {
    console.error('クラウド運動辞書保存エラー', error);
    return NextResponse.json(
      { error: 'クラウド運動辞書の保存に失敗しました' },
      { status: 500 },
    );
  }
}
