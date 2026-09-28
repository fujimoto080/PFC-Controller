import { NextResponse } from 'next/server';
import { defineRoute, noContent } from '@/lib/api/handler';
import { usageEventsSchema } from '@/lib/api/schemas';
import { listUsageSummary, recordUsageEvents } from '@/lib/server/usage-events';

export const GET = defineRoute(
  { label: '利用状況の集計', auth: true },
  async (_req, { userId }) => NextResponse.json(await listUsageSummary(userId)),
);

export const POST = defineRoute(
  { label: '利用状況の記録', auth: true, body: usageEventsSchema },
  async (_req, { userId, body }) => {
    await recordUsageEvents(userId, body.events);
    return noContent();
  },
);
