import { NextRequest, NextResponse } from 'next/server';
import { setCloudFoods } from '@/lib/cloud-data';
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FoodsRequest;
    const syncKey = normalizeSyncKey(body.syncKey);

    if (!isValidSyncKey(syncKey)) {
      return invalidSyncKeyResponse();
    }

    if (!Array.isArray(body.foods)) {
      return NextResponse.json({ error: 'foods の形式が不正です' }, { status: 400 });
    }

    const updatedAt = parseUpdatedAt(body.updatedAt);
    await setCloudFoods(syncKey, body.foods, updatedAt);

    return NextResponse.json({ ok: true, updatedAt });
  } catch (error) {
    console.error('クラウド食品辞書保存エラー', error);
    return NextResponse.json(
      { error: 'クラウド食品辞書の保存に失敗しました' },
      { status: 500 },
    );
  }
}
