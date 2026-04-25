import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineDynamicRoute } from '@/lib/api/handler';
import { deleteLogItem, updateLogItem } from '@/lib/server/log-items';

const inputSchema = z.object({
  name: z.string().min(1),
  protein: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  calories: z.number().nonnegative(),
  timestamp: z.number().int().positive(),
  store: z.string().optional(),
  storeGroup: z.string().optional(),
  image: z.string().optional(),
});

const idSchema = z.string().uuid();

type Params = { id: string };

export const PATCH = defineDynamicRoute<z.infer<typeof inputSchema>, true, Params>(
  {
    label: '食事記録の更新',
    auth: true,
    validateParams: ({ id }) =>
      idSchema.safeParse(id).success ? true : { status: 400, message: '不正な ID' },
    body: () => inputSchema,
  },
  async (_req, { userId, body, params }) => {
    const item = await updateLogItem(userId, params.id, body);
    if (!item) {
      return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 });
    }
    return NextResponse.json({ item, date: item.date });
  },
);

export const DELETE = defineDynamicRoute<undefined, true, Params>(
  {
    label: '食事記録の削除',
    auth: true,
    validateParams: ({ id }) =>
      idSchema.safeParse(id).success ? true : { status: 400, message: '不正な ID' },
  },
  async (_req, { userId, params }) => {
    const result = await deleteLogItem(userId, params.id);
    if (!result) {
      return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, date: result.date });
  },
);
