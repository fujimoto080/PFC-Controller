import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { foodCreateSchema } from '@/lib/api/schemas';
import { upsertFood } from '@/lib/server/foods';

export const POST = defineRoute(
  { label: '食品の作成', auth: true, body: foodCreateSchema },
  async (_req, { userId, body: { id, ...input } }) =>
    NextResponse.json(await upsertFood(userId, id, input)),
);
