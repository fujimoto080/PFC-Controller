import { NextRequest, NextResponse } from 'next/server';
import { insertCloudLogs, updateCloudLogs } from '@/lib/cloud-data';
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

async function parseAndValidate(request: NextRequest) {
  const body = (await request.json()) as LogsRequest;
  const syncKey = normalizeSyncKey(body.syncKey);

  if (!isValidSyncKey(syncKey)) {
    return { error: invalidSyncKeyResponse() } as const;
  }

  if (!body.logs || typeof body.logs !== 'object' || Array.isArray(body.logs)) {
    return {
      error: NextResponse.json({ error: 'logs の形式が不正です' }, { status: 400 }),
    } as const;
  }

  return {
    syncKey,
    logs: body.logs as Record<string, unknown>,
    updatedAt: parseUpdatedAt(body.updatedAt),
  } as const;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseAndValidate(request);
    if ('error' in parsed) return parsed.error;

    await insertCloudLogs(parsed.syncKey, parsed.logs, parsed.updatedAt);
    return NextResponse.json({ ok: true, updatedAt: parsed.updatedAt, method: 'POST' });
  } catch (error) {
    console.error('クラウドログinsertエラー', error);
    return NextResponse.json({ error: 'クラウドログのinsertに失敗しました' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const parsed = await parseAndValidate(request);
    if ('error' in parsed) return parsed.error;

    await updateCloudLogs(parsed.syncKey, parsed.logs, parsed.updatedAt);
    return NextResponse.json({ ok: true, updatedAt: parsed.updatedAt, method: 'PUT' });
  } catch (error) {
    console.error('クラウドログupdateエラー', error);
    return NextResponse.json({ error: 'クラウドログのupdateに失敗しました' }, { status: 500 });
  }
}
