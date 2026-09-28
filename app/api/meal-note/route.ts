import { NextResponse } from 'next/server';
import { defineRoute, noContent } from '@/lib/api/handler';
import { mealNoteSchema } from '@/lib/api/schemas';
import { getMealNote, saveMealNote } from '@/lib/server/meal-notes';
import type { MealNote } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export const GET = defineRoute(
  { label: '今日の予定・気分の取得', auth: true },
  async (_req, { userId }) =>
    NextResponse.json<MealNote>({
      note: await getMealNote(userId, formatDate(Date.now())),
    }),
);

export const PUT = defineRoute(
  { label: '今日の予定・気分の保存', auth: true, body: mealNoteSchema },
  async (_req, { userId, body }) => {
    await saveMealNote(userId, formatDate(Date.now()), body.note);
    return noContent();
  },
);
