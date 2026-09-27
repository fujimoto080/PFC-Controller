import { MealSuggestView } from '@/components/suggest/MealSuggestView';
import { mealSlotSchema } from '@/lib/api/schemas';

/** 通知からは ?slot=lunch のように食事枠を指定して開かれる。 */
export default async function SuggestPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string }>;
}) {
  const { slot } = await searchParams;
  const parsed = mealSlotSchema.safeParse(slot);
  return (
    <MealSuggestView initialSlot={parsed.success ? parsed.data : undefined} />
  );
}
