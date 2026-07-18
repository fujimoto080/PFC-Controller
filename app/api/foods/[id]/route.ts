import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineDynamicRoute } from '@/lib/api/handler';
import { logItemInputSchema } from '@/lib/api/schemas';
import { deleteFood, upsertFood } from '@/lib/server/foods';

interface Params { id: string }

const isValidId = (id: string) => id.trim().length > 0;

export const PATCH = defineDynamicRoute<z.infer<typeof logItemInputSchema>, true, Params>(
  {
    label: '食品の更新',
    auth: true,
    validateParams: ({ id }) =>
      isValidId(id) ? true : { status: 400, message: '不正な ID' },
    body: () => logItemInputSchema,
  },
  async (_req, { userId, body, params }) => {
    const item = await upsertFood(userId, params.id, body);
    return NextResponse.json({ item });
  },
);

export const DELETE = defineDynamicRoute<undefined, true, Params>(
  {
    label: '食品の削除',
    auth: true,
    validateParams: ({ id }) =>
      isValidId(id) ? true : { status: 400, message: '不正な ID' },
  },
  async (_req, { userId, params }) => {
    await deleteFood(userId, params.id);
    return NextResponse.json({ ok: true });
  },
);
