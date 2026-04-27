import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { logItemInputSchema } from '@/lib/api/schemas';
import { createLogItem } from '@/lib/server/log-items';

export const POST = defineRoute(
  { label: '食事記録の作成', auth: true, body: logItemInputSchema },
  async (_req, { userId, body }) => {
    const item = await createLogItem(userId, body);
    return NextResponse.json({ item, date: item.date });
  },
);
