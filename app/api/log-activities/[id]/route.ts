import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineDynamicRoute } from '@/lib/api/handler';
import { logActivityInputSchema, uuidSchema } from '@/lib/api/schemas';
import { deleteLogActivity, updateLogActivity } from '@/lib/server/log-activities';

type Params = { id: string };

export const PATCH = defineDynamicRoute<z.infer<typeof logActivityInputSchema>, true, Params>(
  {
    label: '運動記録の更新',
    auth: true,
    validateParams: ({ id }) =>
      uuidSchema.safeParse(id).success ? true : { status: 400, message: '不正な ID' },
    body: () => logActivityInputSchema,
  },
  async (_req, { userId, body, params }) => {
    const activity = await updateLogActivity(userId, params.id, body);
    if (!activity) {
      return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 });
    }
    return NextResponse.json({ activity, date: activity.date });
  },
);

export const DELETE = defineDynamicRoute<undefined, true, Params>(
  {
    label: '運動記録の削除',
    auth: true,
    validateParams: ({ id }) =>
      uuidSchema.safeParse(id).success ? true : { status: 400, message: '不正な ID' },
  },
  async (_req, { userId, params }) => {
    const result = await deleteLogActivity(userId, params.id);
    if (!result) {
      return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, date: result.date });
  },
);
