import { NextResponse } from 'next/server';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { mealSlotSchema } from '@/lib/api/schemas';
import { mealSlotLabel } from '@/lib/meal-schedule';
import {
  generateMealSuggestion,
  getRecentLocation,
} from '@/lib/server/meal-suggestions';
import { listSubscribedUserIds, sendPush } from '@/lib/server/push';

export const maxDuration = 300;

/**
 * Vercel Cron から朝・昼・夜に呼ばれ、通知を購読しているユーザーごとに提案を作って通知する。
 * Vercel は CRON_SECRET を Bearer トークンとして付けて呼び出す。
 */
export const GET = defineRoute(
  { label: '食事提案の定期実行', auth: false },
  async (request) => {
    const secret = process.env.CRON_SECRET;
    if (
      !secret ||
      request.headers.get('authorization') !== `Bearer ${secret}`
    ) {
      throw new ApiError('認証が必要です', 401);
    }
    const parsed = mealSlotSchema.safeParse(
      request.nextUrl.searchParams.get('slot'),
    );
    if (!parsed.success) throw new ApiError('slot が不正です', 400);
    const slot = parsed.data;

    const userIds = await listSubscribedUserIds();
    const results = await Promise.allSettled(
      userIds.map(async (userId) => {
        const suggestion = await generateMealSuggestion(userId, {
          slot,
          location: await getRecentLocation(userId),
        });
        await sendPush(userId, {
          title: `${mealSlotLabel(slot)}の提案`,
          body: suggestion.summary,
          url: `/suggest?slot=${slot}`,
        });
      }),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    for (const failure of failed) console.error('[cron] 提案に失敗', failure);
    return NextResponse.json({
      users: userIds.length,
      failed: failed.length,
    });
  },
);
