'use client';

import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logFood } from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';
import { toast } from '@/lib/toast';
import type { FoodItem } from '@/lib/types';

async function quickAdd(food: FoodItem) {
  if (await logFood(food, Date.now())) {
    toast.success(`${food.name}を追加しました`);
  }
}

export function QuickAddButtons() {
  const { foods, settings } = useAppState();
  const favorites = useMemo(
    () =>
      settings.favoriteFoodIds.flatMap((id) => foods.find((food) => food.id === id) ?? []),
    [foods, settings.favoriteFoodIds],
  );

  if (favorites.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          よく使う食べ物を設定すると、ここにクイック追加ボタンが表示されます。
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          食品管理ページで星アイコンをクリックしてお気に入りに追加できます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">よく使う食べ物</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {favorites.map((food) => (
          <Button
            key={food.id}
            variant="outline"
            className="flex-shrink-0 flex-col items-start h-auto py-3 px-4 min-w-[140px]"
            onClick={() => { void quickAdd(food); }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Plus className="h-4 w-4" />
              {food.store && (
                <span className="text-xs text-muted-foreground">{food.store}</span>
              )}
            </div>
            <span className="font-medium text-sm">{food.name}</span>
            <span className="text-xs text-muted-foreground mt-1">
              {food.calories}kcal
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
