import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { foodInputSchema } from '@/lib/api/schemas';
import { createLogItem } from '@/lib/server/log-items';

export const POST = defineRoute(
  { label: '食事記録の作成', auth: true, body: foodInputSchema },
  async (_req, { userId, body }) => {
    const { date: _date, ...item } = await createLogItem(userId, body);
    return NextResponse.json(item);
  },
);
