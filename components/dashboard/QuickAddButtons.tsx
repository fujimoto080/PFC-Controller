'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFavoriteFoods, addFoodItem } from '@/lib/storage';
import { FoodItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { generateId } from '@/lib/utils';

const getCurrentTimestamp = () => Date.now();

export function QuickAddButtons() {
  const [favorites, setFavorites] = useState<FoodItem[]>([]);

  useEffect(() => {
    const loadFavorites = () => {
      setFavorites(getFavoriteFoods());
    };

    loadFavorites();

    // Listen for updates
    const handleUpdate = () => loadFavorites();
    window.addEventListener('pfc-update', handleUpdate);
    return () => window.removeEventListener('pfc-update', handleUpdate);
  }, []);

  const handleQuickAdd = useCallback((food: FoodItem) => {
    const timestamp = getCurrentTimestamp();
    const newItem: FoodItem = {
      ...food,
      id: generateId(),
      timestamp,
    };

    addFoodItem(newItem);
    toast.success(`${food.name}を追加しました`);
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
