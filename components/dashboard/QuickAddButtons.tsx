'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFavoriteFoods, addFoodItem } from '@/lib/storage';
import { FoodItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useSubscribeToPfcUpdate } from '@/hooks/use-pfc-update';

const getCurrentTimestamp = () => Date.now();

export function QuickAddButtons() {
  const [favorites, setFavorites] = useState<FoodItem[]>([]);

  // 初回マウント時にお気に入りを読み込む
  useEffect(() => {
    queueMicrotask(() => {
      setFavorites(getFavoriteFoods());
    });
  }, []);

  // pfc-update イベントで再読み込み
  const handlePfcUpdate = useCallback(() => {
    queueMicrotask(() => {
      setFavorites(getFavoriteFoods());
    });
  }, []);
  useSubscribeToPfcUpdate(handlePfcUpdate);

  const handleQuickAdd = useCallback(async (food: FoodItem) => {
    const timestamp = getCurrentTimestamp();
    const { id: _id, ...rest } = food;
    void _id;
    try {
      await addFoodItem({ ...rest, timestamp });
      toast.success(`${food.name}を追加しました`);
    } catch {
      // addFoodItem 側でエラートーストを表示済み
    }
  }, []);

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
            onClick={() => handleQuickAdd(food)}
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
