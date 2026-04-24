import { NextRequest, NextResponse } from 'next/server';
import { insertCloudSettings, updateCloudSettings } from '@/lib/cloud-data';
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

async function parseAndValidate(request: NextRequest) {
  const body = (await request.json()) as SettingsRequest;
  const syncKey = normalizeSyncKey(body.syncKey);

  if (!isValidSyncKey(syncKey)) {
    return { error: invalidSyncKeyResponse() } as const;
  }

  if (!body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings)) {
    return {
      error: NextResponse.json({ error: 'settings の形式が不正です' }, { status: 400 }),
    } as const;
  }

  return {
    syncKey,
    settings: body.settings as Record<string, unknown>,
    updatedAt: parseUpdatedAt(body.updatedAt),
  } as const;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseAndValidate(request);
    if ('error' in parsed) return parsed.error;

    await insertCloudSettings(parsed.syncKey, parsed.settings, parsed.updatedAt);
    return NextResponse.json({ ok: true, updatedAt: parsed.updatedAt, method: 'POST' });
  } catch (error) {
    console.error('クラウド設定insertエラー', error);
    return NextResponse.json({ error: 'クラウド設定のinsertに失敗しました' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const parsed = await parseAndValidate(request);
    if ('error' in parsed) return parsed.error;

    await updateCloudSettings(parsed.syncKey, parsed.settings, parsed.updatedAt);
    return NextResponse.json({ ok: true, updatedAt: parsed.updatedAt, method: 'PUT' });
  } catch (error) {
    console.error('クラウド設定updateエラー', error);
    return NextResponse.json({ error: 'クラウド設定のupdateに失敗しました' }, { status: 500 });
  }
}
