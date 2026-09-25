'use client';

import { useMemo } from 'react';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { getSimilarFoodSuggestions } from '@/lib/food-suggestions';
import type { FoodItem } from '@/lib/types';

interface SimilarFoodSuggestionsProps {
  foods: FoodItem[];
  name: string;
  onSelect: (food: FoodItem) => void;
}

/** 入力中の食品名に似た食品辞書の候補を表示する。 */
export function SimilarFoodSuggestions({
  foods,
  name,
  onSelect,
}: SimilarFoodSuggestionsProps) {
  const suggestions = useMemo(
    () => getSimilarFoodSuggestions(foods, name),
    [foods, name],
  );
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2 pt-1">
      <p className="text-muted-foreground text-xs">似ている食品候補</p>
      {suggestions.map((food) => (
        <button
          key={food.id}
          type="button"
          className="hover:bg-muted/80 w-full rounded-md border p-2 text-left transition-colors"
          onClick={() => {
            onSelect(food);
          }}
        >
          <p className="text-sm font-medium">{food.name}</p>
          <PfcMacroLine food={food} />
          {food.store && (
            <p className="text-muted-foreground text-xs">{food.store}</p>
          )}
        </button>
      ))}
    </div>
  );
}
