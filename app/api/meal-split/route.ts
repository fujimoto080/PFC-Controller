import { defineRoute, noContent } from '@/lib/api/handler';
import { mealSplitSchema } from '@/lib/api/schemas';
import { saveMealSplit } from '@/lib/server/meal-splits';
import { formatDate } from '@/lib/utils';

export const PUT = defineRoute(
  { label: '朝昼晩の配分の保存', auth: true, body: mealSplitSchema },
  async (_req, { userId, body }) => {
    await saveMealSplit(userId, formatDate(Date.now()), body);
    return noContent();
  },
);
