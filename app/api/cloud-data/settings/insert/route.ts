import { NextRequest, NextResponse } from 'next/server';
import { insertCloudSettings } from '@/lib/cloud-data';
import {
  invalidSyncKeyResponse,
  isValidSyncKey,
  normalizeSyncKey,
  parseUpdatedAt,
} from '@/lib/cloud-sync-api';

interface SettingsRequest {
  settings?: unknown;
  updatedAt?: unknown;
  syncKey?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SettingsRequest;
    const syncKey = normalizeSyncKey(body.syncKey);

    if (!isValidSyncKey(syncKey)) {
      return invalidSyncKeyResponse();
    }

    if (!body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings)) {
      return NextResponse.json({ error: 'settings の形式が不正です' }, { status: 400 });
    }

    const updatedAt = parseUpdatedAt(body.updatedAt);
    await insertCloudSettings(syncKey, body.settings as Record<string, unknown>, updatedAt);

    return NextResponse.json({ ok: true, updatedAt, mode: 'insert' });
  } catch (error) {
    console.error('クラウド設定insertエラー', error);
    return NextResponse.json(
      { error: 'クラウド設定のinsertに失敗しました' },
      { status: 500 },
    );
  }
}
