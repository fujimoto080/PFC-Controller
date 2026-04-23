import { NextResponse } from 'next/server';

export function normalizeSyncKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isValidSyncKey(syncKey: string): boolean {
  return syncKey.length >= 8;
}

export function parseUpdatedAt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : Date.now();
}

export function invalidSyncKeyResponse() {
  return NextResponse.json(
    { error: '同期キーが不正です' },
    { status: 400 },
  );
}
