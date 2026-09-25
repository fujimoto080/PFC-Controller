import { NextResponse } from 'next/server';
import { ApiError, defineRoute, noContent } from '@/lib/api/handler';
import { foodInputSchema, foodParamsSchema } from '@/lib/api/schemas';
import { deleteFood, upsertFood } from '@/lib/server/foods';

export const PATCH = defineRoute(
  { label: '食品の更新', auth: true, params: foodParamsSchema, body: foodInputSchema },
  async (_req, { userId, params, body }) =>
    NextResponse.json(await upsertFood(userId, params.id, body)),
);

export const DELETE = defineRoute(
  { label: '食品の削除', auth: true, params: foodParamsSchema },
  async (_req, { userId, params }) => {
    if (!(await deleteFood(userId, params.id))) throw new ApiError('対象が見つかりません', 404);
    return noContent();
  },
);
