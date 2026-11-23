import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { imageBodySchema } from '@/lib/api/schemas';
import { readDrexNutrition } from '@/lib/server/drex-nutrition';

export const POST = defineRoute(
  { label: '成分表示の読み取り', auth: true, body: imageBodySchema },
  async (_req, { body }) => {
    const reading = await readDrexNutrition(body.imageDataUrls);
    return NextResponse.json(reading);
  },
);
