import { z } from 'zod';
import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { replaceSettings } from '@/lib/persistent-store';

const bodySchema = z.object({ settings: z.record(z.string(), z.unknown()) });

export const POST = defineRoute(
  { label: '設定', auth: true, body: bodySchema },
  async (_req, { userId, body }) => {
    await replaceSettings(userId, body.settings);
    return NextResponse.json({ ok: true });
  },
);
