import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { foodImportSchema } from '@/lib/api/schemas';
import { upsertFoodsBulk } from '@/lib/server/foods';
import { getUserIdByEmail } from '@/lib/server/users';

// 大量件数をまとめて処理するため Node ランタイム固定・タイムアウト延長。
export const runtime = 'nodejs';
export const maxDuration = 60;

function tokensMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * 食品辞書の一括インポート（seed）用エンドポイント。
 * ブラウザセッションではなく共有トークンで認証するため、スクリプトから機械的に呼べる。
 * SEED_API_TOKEN が未設定なら無効（503）。
 *   POST /api/foods/import
 *   Authorization: Bearer <SEED_API_TOKEN>
 *   body: { email, foods: [{ id, name, protein, fat, carbs, calories, store?, storeGroup?, image?, timestamp? }] }
 */
export const POST = defineRoute(
  { label: '食品の一括インポート', body: foodImportSchema },
  async (request, { body }) => {
    const expected = process.env.SEED_API_TOKEN?.trim();
    if (!expected) {
      throw new ApiError('インポート API は無効です（SEED_API_TOKEN 未設定）', 503);
    }
    const header = request.headers.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!token || !tokensMatch(token, expected)) {
      throw new ApiError('認証に失敗しました', 401);
    }

    const userId = await getUserIdByEmail(body.email);
    if (!userId) {
      throw new ApiError(`ユーザーが見つかりません: ${body.email}`, 404);
    }

    const now = Date.now();
    const items = body.foods.map((f) => ({ ...f, timestamp: f.timestamp ?? now }));
    const count = await upsertFoodsBulk(userId, items);
    return NextResponse.json({ count });
  },
);
