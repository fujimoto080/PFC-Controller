import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { ApiError } from '@/lib/api/handler';

function tokensMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * 環境変数の共有トークンによる Bearer 認証。セッションを持たない外部クライアント用。
 * 環境変数が未設定ならエンドポイントごと無効（503）、トークンが違えば 401。
 */
export function requireBearerToken(
  request: NextRequest,
  envName: string,
  label: string,
): void {
  const expected = process.env[envName]?.trim();
  if (!expected) {
    throw new ApiError(`${label}は無効です（${envName} 未設定）`, 503);
  }
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : '';
  if (!token || !tokensMatch(token, expected)) {
    throw new ApiError('認証に失敗しました', 401);
  }
}
