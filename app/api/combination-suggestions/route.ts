import { NextResponse } from 'next/server';
import { ApiError, defineRoute } from '@/lib/api/handler';
import { mealSlotSchema } from '@/lib/api/schemas';
import { CATALOG_STORES } from '@/lib/catalog/stores';
import { slotForTime } from '@/lib/meal-schedule';
import { suggestCombinations } from '@/lib/server/combination-suggestions';

export const GET = defineRoute(
  { label: '組み合わせ提案', auth: true },
  async (request, { userId }) => {
    const params = request.nextUrl.searchParams;
    const store = CATALOG_STORES.find((s) => s.id === params.get('store'));
    if (!store) throw new ApiError('store が不正です', 400);
    const slotParam = params.get('slot');
    const slot = slotParam
      ? mealSlotSchema.safeParse(slotParam).data
      : slotForTime(Date.now());
    if (!slot) throw new ApiError('slot が不正です', 400);
    return NextResponse.json(await suggestCombinations(userId, store, slot));
  },
);
