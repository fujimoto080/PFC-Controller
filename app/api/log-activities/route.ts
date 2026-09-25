import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { activityInputSchema } from '@/lib/api/schemas';
import { createLogActivity } from '@/lib/server/log-activities';

export const POST = defineRoute(
  { label: '運動記録の作成', auth: true, body: activityInputSchema },
  async (_req, { userId, body }) => {
    const { date: _date, ...activity } = await createLogActivity(userId, body);
    return NextResponse.json(activity);
  },
);
