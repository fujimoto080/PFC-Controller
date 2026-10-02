import { NextResponse } from 'next/server';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { foodImportSchema } from '@/lib/api/schemas';
import { requireBearerToken } from '@/lib/server/bearer-auth';
import { getUserIdByEmail } from '@/lib/server/db';
import { upsertFoodsBulk } from '@/lib/server/foods';

// 大量件数をまとめて処理するため Node ランタイム固定・タイムアウト延長。
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 食品辞書の一括インポート（seed）用エンドポイント。
 * ブラウザセッションではなく共有トークンで認証するため、スクリプトから機械的に呼べる。
 * SEED_API_TOKEN が未設定なら無効（503）。
 *   POST /api/foods/import
 *   Authorization: Bearer <SEED_API_TOKEN>
 *   body: { email, foods: [{ id, name, protein, fat, carbs, calories, store?, storeGroup?, image?, timestamp? }] }
 */
export const POST = defineRoute(
  { label: '食品の一括インポート', auth: false, body: foodImportSchema },
  async (request, { body }) => {
    requireBearerToken(request, 'SEED_API_TOKEN', 'インポート API');

    const userId = await getUserIdByEmail(body.email);
    if (!userId) {
      throw new ApiError(`ユーザーが見つかりません: ${body.email}`, 404);
    }

    const now = Date.now();
    const items = body.foods.map((f) => ({
      ...f,
      timestamp: f.timestamp ?? now,
    }));
    const count = await upsertFoodsBulk(userId, items);
    return NextResponse.json({ count });
  },
);
