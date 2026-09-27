'use client';

import { useMemo } from 'react';
import { useWatch, type Control, type UseFormRegister } from 'react-hook-form';
import { LabeledInput } from '@/components/input/FormFields';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { useAppState } from '@/lib/client/store';
import type { PfcFormValues } from '@/lib/food-form';
import { getSimilarFoodSuggestions } from '@/lib/food-suggestions';
import type { FoodItem } from '@/lib/types';

interface FoodNameFieldProps {
  register: UseFormRegister<PfcFormValues>;
  control: Control<PfcFormValues>;
  /** 候補を選んだとき。フォームにその食品の値を入れる */
  onSelect: (food: FoodItem) => void;
}

/** 食品名の入力欄と、入力中の名前に似た食品辞書の候補。 */
export function FoodNameField({
  register,
  control,
  onSelect,
}: FoodNameFieldProps) {
  const { foods } = useAppState();
  const name = useWatch({ control, name: 'name' });
  const suggestions = useMemo(
    () => getSimilarFoodSuggestions(foods, name),
    [foods, name],
  );

  return (
    <div className="space-y-2">
      <LabeledInput
        label="食品名"
        {...register('name', { required: true })}
        placeholder="例: サラダチキン"
      />
      {suggestions.length > 0 && (
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
      )}
    </div>
  );
}
