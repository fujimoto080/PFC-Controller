import { NextResponse } from 'next/server';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { mealSlotLabel } from '@/lib/meal-schedule';
import {
  generateMealSuggestions,
  getRecentLocation,
} from '@/lib/server/meal-suggestions';
import { listSubscribedUserIds, sendPush } from '@/lib/server/push';

export const maxDuration = 300;

/**
 * Vercel Cron から毎朝呼ばれ、通知を購読しているユーザーごとに今日の朝昼晩の提案を作って通知する。
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

    const userIds = await listSubscribedUserIds();
    const results = await Promise.allSettled(
      userIds.map(async (userId) => {
        const suggestions = await generateMealSuggestions(userId, {
          location: await getRecentLocation(userId),
        });
        await sendPush(userId, {
          title: '今日の食事の提案',
          body: suggestions
            .map((s) => `${mealSlotLabel(s.slot)}: ${s.summary}`)
            .join('\n'),
          url: '/suggest',
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
