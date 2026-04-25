import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineDynamicRoute } from '@/lib/api/handler';
import { deleteLogActivity, updateLogActivity } from '@/lib/server/log-activities';

const inputSchema = z.object({
  sportId: z.string().min(1),
  name: z.string().min(1),
  caloriesBurned: z.number().nonnegative(),
  timestamp: z.number().int().positive(),
});

const idSchema = z.string().uuid();

type Params = { id: string };

export const PATCH = defineDynamicRoute<z.infer<typeof inputSchema>, true, Params>(
  {
    label: '運動記録の更新',
    auth: true,
    validateParams: ({ id }) =>
      idSchema.safeParse(id).success ? true : { status: 400, message: '不正な ID' },
    body: () => inputSchema,
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
      idSchema.safeParse(id).success ? true : { status: 400, message: '不正な ID' },
  },
  async (_req, { userId, params }) => {
    const result = await deleteLogActivity(userId, params.id);
    if (!result) {
      return NextResponse.json({ error: '対象が見つかりません' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, date: result.date });
  },
);
