import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { createLogItem } from '@/lib/server/log-items';

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

export const POST = defineRoute(
  { label: '食事記録の作成', auth: true, body: inputSchema },
  async (_req, { userId, body }) => {
    const item = await createLogItem(userId, body);
    return NextResponse.json({ item, date: item.date });
  },
);
