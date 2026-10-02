import { NextResponse } from 'next/server';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { healthSyncSchema } from '@/lib/api/schemas';
import { requireBearerToken } from '@/lib/server/bearer-auth';
import { getUserIdByEmail } from '@/lib/server/db';
import { replaceHealthActivity } from '@/lib/server/log-activities';

/**
 * スマホ（Android の Health Connect など）の活動消費カロリーを 1 日 1 件で同期する。
 * ブラウザセッションではなく共有トークンで認証する。HEALTH_SYNC_TOKEN が未設定なら無効（503）。
 *   PUT /api/health-sync
 *   Authorization: Bearer <HEALTH_SYNC_TOKEN>
 *   body: { email, date: 'YYYY-MM-DD'(JST), caloriesBurned }
 * 基礎代謝分は目標カロリーに含まれるため、送るのはアクティブ消費のみ。
 */
export const PUT = defineRoute(
  { label: 'ヘルスケア連携の同期', auth: false, body: healthSyncSchema },
  async (request, { body }) => {
    requireBearerToken(request, 'HEALTH_SYNC_TOKEN', 'ヘルスケア連携');

    const userId = await getUserIdByEmail(body.email);
    if (!userId) {
      throw new ApiError(`ユーザーが見つかりません: ${body.email}`, 404);
    }

    await replaceHealthActivity(userId, body.date, body.caloriesBurned);
    return NextResponse.json({ ok: true });
  },
);
