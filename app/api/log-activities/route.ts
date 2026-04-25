import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { createLogActivity } from '@/lib/server/log-activities';

const inputSchema = z.object({
  sportId: z.string().min(1),
  name: z.string().min(1),
  caloriesBurned: z.number().nonnegative(),
  timestamp: z.number().int().positive(),
});

export const POST = defineRoute(
  { label: '運動記録の作成', auth: true, body: inputSchema },
  async (_req, { userId, body }) => {
    const activity = await createLogActivity(userId, body);
    return NextResponse.json({ activity, date: activity.date });
  },
);
