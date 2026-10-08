'use client';

import { useWatch, type Control, type UseFormRegister } from 'react-hook-form';
import { LabeledInput } from '@/components/input/FormFields';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { useFoodSearch } from '@/hooks/use-food-search';
import type { FoodTemplate, PfcFormValues } from '@/lib/food-form';

interface FoodNameFieldProps {
  register: UseFormRegister<PfcFormValues>;
  control: Control<PfcFormValues>;
  /** 候補を選んだとき。フォームにその食品の値を入れる */
  onSelect: (food: FoodTemplate) => void;
}

/** 食品名の入力欄と、過去の記録・カタログから探した候補。 */
export function FoodNameField({
  register,
  control,
  onSelect,
}: FoodNameFieldProps) {
  const name = useWatch({ control, name: 'name' });
  const search = useFoodSearch(name);
  const suggestions = name.trim().length >= 2 ? search.foods : [];

  return (
    <div className="space-y-2">
      <LabeledInput
        label="食品名"
        {...register('name', { required: true })}
        placeholder="例: サラダチキン"
      />
      {search.loading && (
        <output className="text-muted-foreground block text-xs">
          商品を探しています…
        </output>
      )}
      {suggestions.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-muted-foreground text-xs">食品候補</p>
          {suggestions.map((food) => (
            <button
              key={`${food.store ?? ''}|${food.name}|${food.calories}|${food.protein}|${food.fat}|${food.carbs}`}
              type="button"
              data-track="食品名の候補を選択"
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
