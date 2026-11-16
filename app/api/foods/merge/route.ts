import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { mergeFoods } from '@/lib/server/foods';

const bodySchema = z
  .object({
    targetId: z.string().min(1),
    sourceIds: z.array(z.string().min(1)).min(1),
  })
  .refine(
    ({ targetId, sourceIds }) =>
      !sourceIds.includes(targetId) &&
      new Set(sourceIds).size === sourceIds.length,
    { message: '異なる食品を選択してください' },
  );

export const POST = defineRoute(
  { label: '食品の名寄せ', auth: true, body: bodySchema },
  async (_request, { userId, body }) => {
    const result = await mergeFoods(userId, body.targetId, body.sourceIds);
    if (!result) throw new ApiError('選択した食品が見つかりません', 409);
    return NextResponse.json(result);
  },
);
