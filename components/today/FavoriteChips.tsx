'use client';

import { useMemo } from 'react';
import { Star } from 'lucide-react';
import { addFoodItem } from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';
import { toLogInput } from '@/lib/food-form';
import { toast } from '@/lib/toast';
import { defaultTimestampFor } from '@/lib/utils';

/** お気に入り食品をワンタップで選択日に記録する。お気に入りが無ければ何も出さない。 */
export function FavoriteChips({ date }: { date: string }) {
  const { foods, settings } = useAppState();
  const favorites = useMemo(
    () =>
      settings.favoriteFoodIds.flatMap(
        (id) => foods.find((food) => food.id === id) ?? [],
      ),
    [foods, settings.favoriteFoodIds],
  );

  if (favorites.length === 0) return null;

  return (
    <div
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      data-swipe-ignore
    >
      {favorites.map((food) => (
        <button
          key={food.id}
          type="button"
          className="bg-card hover:bg-muted/60 flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-transform active:scale-95"
          onClick={() => {
            void addFoodItem(toLogInput(food, defaultTimestampFor(date)));
            toast.success(`${food.name}を記録しました`);
          }}
        >
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          {food.name}
          <span className="text-muted-foreground text-xs">
            {food.calories}kcal
          </span>
        </button>
      ))}
    </div>
  );
}
