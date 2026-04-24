import { NextRequest, NextResponse } from 'next/server';
import { insertCloudFoods, updateCloudFoods } from '@/lib/cloud-data';
import {
  invalidSyncKeyResponse,
  isValidSyncKey,
  normalizeSyncKey,
  parseUpdatedAt,
} from '@/lib/cloud-sync-api';

interface FoodsRequest {
  foods?: unknown;
  updatedAt?: unknown;
  syncKey?: unknown;
}

async function parseAndValidate(request: NextRequest) {
  const body = (await request.json()) as FoodsRequest;
  const syncKey = normalizeSyncKey(body.syncKey);

  if (!isValidSyncKey(syncKey)) {
    return { error: invalidSyncKeyResponse() } as const;
  }

  if (!Array.isArray(body.foods)) {
    return {
      error: NextResponse.json({ error: 'foods の形式が不正です' }, { status: 400 }),
    } as const;
  }

  return {
    syncKey,
    foods: body.foods,
    updatedAt: parseUpdatedAt(body.updatedAt),
  } as const;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseAndValidate(request);
    if ('error' in parsed) return parsed.error;

    await insertCloudFoods(parsed.syncKey, parsed.foods, parsed.updatedAt);
    return NextResponse.json({ ok: true, updatedAt: parsed.updatedAt, method: 'POST' });
  } catch (error) {
    console.error('クラウド食品辞書insertエラー', error);
    return NextResponse.json({ error: 'クラウド食品辞書のinsertに失敗しました' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const parsed = await parseAndValidate(request);
    if ('error' in parsed) return parsed.error;

    await updateCloudFoods(parsed.syncKey, parsed.foods, parsed.updatedAt);
    return NextResponse.json({ ok: true, updatedAt: parsed.updatedAt, method: 'PUT' });
  } catch (error) {
    console.error('クラウド食品辞書updateエラー', error);
    return NextResponse.json({ error: 'クラウド食品辞書のupdateに失敗しました' }, { status: 500 });
  }
}
