import { NextResponse } from 'next/server';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { mealSlotSchema } from '@/lib/api/schemas';
import { slotForTime } from '@/lib/meal-schedule';
import { suggestCombinations } from '@/lib/server/combination-suggestions';

export const GET = defineRoute(
  { label: '組み合わせ提案', auth: true },
  async (request, { userId }) => {
    const params = request.nextUrl.searchParams;
    const slotParam = params.get('slot');
    const slot = slotParam
      ? mealSlotSchema.safeParse(slotParam).data
      : slotForTime(Date.now());
    if (!slot) throw new ApiError('slot が不正です', 400);
    const result = await suggestCombinations(
      userId,
      params.get('store') ?? '',
      slot,
    );
    if (!result) throw new ApiError('store が不正です', 400);
    return NextResponse.json(result);
  },
);
