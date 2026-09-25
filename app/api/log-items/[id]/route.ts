import { NextResponse } from 'next/server';
import { ApiError, defineRoute, noContent } from '@/lib/api/handler';
import { foodInputSchema, uuidParamsSchema } from '@/lib/api/schemas';
import { deleteLogItem, updateLogItem } from '@/lib/server/log-items';

export const PATCH = defineRoute(
  {
    label: '食事記録の更新',
    auth: true,
    params: uuidParamsSchema,
    body: foodInputSchema,
  },
  async (_req, { userId, params, body }) => {
    const updated = await updateLogItem(userId, params.id, body);
    if (!updated) throw new ApiError('対象が見つかりません', 404);
    const { date: _date, ...item } = updated;
    return NextResponse.json(item);
  },
);

export const DELETE = defineRoute(
  { label: '食事記録の削除', auth: true, params: uuidParamsSchema },
  async (_req, { userId, params }) => {
    if (!(await deleteLogItem(userId, params.id)))
      throw new ApiError('対象が見つかりません', 404);
    return noContent();
  },
);
