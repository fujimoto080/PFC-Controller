import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { replaceSports } from '@/lib/persistent-store';

const bodySchema = z.object({ sports: z.array(z.unknown()) });

export const POST = defineRoute(
  { label: 'スポーツ', auth: true, body: bodySchema },
  async (_req, { userId, body }) => {
    await replaceSports(userId, body.sports);
    return NextResponse.json({ ok: true });
  },
);
