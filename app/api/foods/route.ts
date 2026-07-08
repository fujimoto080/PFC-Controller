import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { foodCreateSchema } from '@/lib/api/schemas';
import { upsertFood } from '@/lib/server/foods';

export const POST = defineRoute(
  { label: '食品の作成', auth: true, body: foodCreateSchema },
  async (_req, { userId, body }) => {
    // body は id + FoodItemInput の各フィールドを持つ。upsertFood は必要なフィールドのみ参照する。
    const item = await upsertFood(userId, body.id, body);
    return NextResponse.json({ item });
  },
);
