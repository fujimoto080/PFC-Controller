import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineDynamicRoute } from '@/lib/api/handler';
import { logItemInputSchema, uuidSchema } from '@/lib/api/schemas';
import { deleteLogItem, updateLogItem } from '@/lib/server/log-items';

type Params = { id: string };

export const PATCH = defineDynamicRoute<z.infer<typeof logItemInputSchema>, true, Params>(
  {
    label: '食事記録の更新',
    auth: true,
    validateParams: ({ id }) =>
      uuidSchema.safeParse(id).success ? true : { status: 400, message: '不正な ID' },
    body: () => logItemInputSchema,
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
      uuidSchema.safeParse(id).success ? true : { status: 400, message: '不正な ID' },
  },
  async (_req, { userId, params }) => {
    const result = await deleteLogItem(userId, params.id);
    if (!result) {
      return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, date: result.date });
  },
);
