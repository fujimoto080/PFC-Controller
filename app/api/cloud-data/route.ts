import { NextRequest, NextResponse } from 'next/server';
import { getCloudData, setCloudData } from '@/lib/cloud-data';
import { hasMeaningfulCloudData, isCloudDataPayload } from '@/lib/cloud-payload';
import {
  invalidSyncKeyResponse,
  isValidSyncKey,
  normalizeSyncKey,
  parseUpdatedAt,
} from '@/lib/cloud-sync-api';

interface CloudDataRequest {
  payload?: unknown;
  updatedAt?: unknown;
  syncKey?: unknown;
}

export async function GET(request: NextRequest) {
  try {
    const syncKey = normalizeSyncKey(request.nextUrl.searchParams.get('syncKey'));
    if (!isValidSyncKey(syncKey)) {
      return invalidSyncKeyResponse();
    }

    const { payload, updatedAt } = await getCloudData(syncKey);
    return NextResponse.json({ payload, updatedAt });
  } catch (error) {
    console.error('クラウドデータ取得エラー', error);
    return NextResponse.json(
      { error: 'クラウドデータの取得に失敗しました' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CloudDataRequest;

    if (!isCloudDataPayload(body.payload)) {
      return NextResponse.json(
        { error: 'クラウドデータの形式が不正です' },
        { status: 400 },
      );
    }

    const syncKey = normalizeSyncKey(body.syncKey);
    if (!isValidSyncKey(syncKey)) {
      return invalidSyncKeyResponse();
    }

    const updatedAt = parseUpdatedAt(body.updatedAt);

    const current = await getCloudData(syncKey);
    const isIncomingEmpty = !hasMeaningfulCloudData(body.payload);
    const hasCurrentData =
      !!current.payload && hasMeaningfulCloudData(current.payload);

    if (isIncomingEmpty && hasCurrentData) {
      return NextResponse.json(
        { error: '空データによる上書きを防止しました。' },
        { status: 409 },
      );
    }

    await setCloudData(syncKey, body.payload, updatedAt);

    return NextResponse.json({ ok: true, updatedAt });
  } catch (error) {
    console.error('クラウドデータ保存エラー', error);
    return NextResponse.json(
      { error: 'クラウドデータの保存に失敗しました' },
      { status: 500 },
    );
  }
}
