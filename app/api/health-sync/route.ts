import { NextResponse } from 'next/server';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { healthSyncSchema } from '@/lib/api/schemas';
import { requireBearerToken } from '@/lib/server/bearer-auth';
import { getUserIdByEmail } from '@/lib/server/db';
import { upsertHealthDaily } from '@/lib/server/health-daily';
import { replaceHealthActivity } from '@/lib/server/log-activities';

/**
 * スマホ（Android の Health Connect など）の 1 日分のデータを同期する。
 * ブラウザセッションではなく共有トークンで認証する。HEALTH_SYNC_TOKEN が未設定なら無効（503）。
 *   PUT /api/health-sync
 *   Authorization: Bearer <HEALTH_SYNC_TOKEN>
 *   body: { email, date: 'YYYY-MM-DD'(JST), caloriesBurned?, weightKg?, bodyFatPercent?, steps? }
 * 送られた項目だけを更新する。基礎代謝分は目標カロリーに含まれるため、
 * caloriesBurned はアクティブ消費のみ。
 */
export const PUT = defineRoute(
  { label: 'ヘルスケア連携の同期', auth: false, body: healthSyncSchema },
  async (request, { body }) => {
    requireBearerToken(request, 'HEALTH_SYNC_TOKEN', 'ヘルスケア連携');

    const userId = await getUserIdByEmail(body.email);
    if (!userId) {
      throw new ApiError(`ユーザーが見つかりません: ${body.email}`, 404);
    }

    if (body.caloriesBurned !== undefined) {
      await replaceHealthActivity(userId, body.date, body.caloriesBurned);
    }
    const { weightKg, bodyFatPercent, steps } = body;
    if (
      weightKg !== undefined ||
      bodyFatPercent !== undefined ||
      steps !== undefined
    ) {
      await upsertHealthDaily(userId, body.date, {
        weightKg,
        bodyFatPercent,
        steps,
      });
    }
    return NextResponse.json({ ok: true });
  },
);
