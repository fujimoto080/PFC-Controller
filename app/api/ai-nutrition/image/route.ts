import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { imageBodySchema } from '@/lib/api/schemas';
import {
  askNutrition,
  IMAGE_READING_INSTRUCTIONS,
} from '@/lib/server/nutrition';
import { callOpenAIWithImage } from '@/lib/server/openai';

export const POST = defineRoute(
  { label: 'AI栄養読み取り', auth: true, body: imageBodySchema },
  async (_req, { body }) => {
    const food = await askNutrition(IMAGE_READING_INSTRUCTIONS, (prompt) =>
      callOpenAIWithImage({ prompt, imageDataUrl: body.imageDataUrl }),
    );
    return NextResponse.json(food);
  },
);
