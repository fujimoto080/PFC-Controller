import { NextRequest, NextResponse } from 'next/server';
import { insertCloudSports, updateCloudSports } from '@/lib/cloud-data';
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

async function parseAndValidate(request: NextRequest) {
  const body = (await request.json()) as SportsRequest;
  const syncKey = normalizeSyncKey(body.syncKey);

  if (!isValidSyncKey(syncKey)) {
    return { error: invalidSyncKeyResponse() } as const;
  }

  if (!Array.isArray(body.sports)) {
    return {
      error: NextResponse.json({ error: 'sports の形式が不正です' }, { status: 400 }),
    } as const;
  }

  return {
    syncKey,
    sports: body.sports,
    updatedAt: parseUpdatedAt(body.updatedAt),
  } as const;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseAndValidate(request);
    if ('error' in parsed) return parsed.error;

    await insertCloudSports(parsed.syncKey, parsed.sports, parsed.updatedAt);
    return NextResponse.json({ ok: true, updatedAt: parsed.updatedAt, method: 'POST' });
  } catch (error) {
    console.error('クラウド運動辞書insertエラー', error);
    return NextResponse.json({ error: 'クラウド運動辞書のinsertに失敗しました' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const parsed = await parseAndValidate(request);
    if ('error' in parsed) return parsed.error;

    await updateCloudSports(parsed.syncKey, parsed.sports, parsed.updatedAt);
    return NextResponse.json({ ok: true, updatedAt: parsed.updatedAt, method: 'PUT' });
  } catch (error) {
    console.error('クラウド運動辞書updateエラー', error);
    return NextResponse.json({ error: 'クラウド運動辞書のupdateに失敗しました' }, { status: 500 });
  }
}
