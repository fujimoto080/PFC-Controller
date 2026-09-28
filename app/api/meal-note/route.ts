import { defineRoute, noContent } from '@/lib/api/handler';
import { mealNoteSchema } from '@/lib/api/schemas';
import { saveMealNote } from '@/lib/server/meal-notes';
import { formatDate } from '@/lib/utils';

export const PUT = defineRoute(
  { label: '今日の予定・気分の保存', auth: true, body: mealNoteSchema },
  async (_req, { userId, body }) => {
    await saveMealNote(userId, formatDate(Date.now()), body.note);
    return noContent();
  },
);
