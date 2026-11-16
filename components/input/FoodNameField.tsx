'use client';

import { useWatch, type Control, type UseFormRegister } from 'react-hook-form';
import { Check } from 'lucide-react';
import { LabeledInput } from '@/components/input/FormFields';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { useFoodSearch } from '@/hooks/use-food-search';
import type { FoodTemplate, PfcFormValues } from '@/lib/food-form';
import { foodCandidateKey } from '@/lib/food-suggestions';

interface FoodNameFieldProps {
  register: UseFormRegister<PfcFormValues>;
  control: Control<PfcFormValues>;
  selectedFood: FoodTemplate | null;
  onNameChange: () => void;
  /** 候補を選んだとき。フォームにその食品の値を入れる */
  onSelect: (food: FoodTemplate) => void;
}

/** 食品名の入力欄と、過去の記録・カタログから探した候補。 */
export function FoodNameField({
  register,
  control,
  selectedFood,
  onNameChange,
  onSelect,
}: FoodNameFieldProps) {
  const name = useWatch({ control, name: 'name' });
  const search = useFoodSearch(name);
  const suggestions = name.trim().length >= 2 ? search.foods : [];
  const selectedKey = selectedFood ? foodCandidateKey(selectedFood) : null;

  return (
    <div className="space-y-2">
      <LabeledInput
        label="食品名"
        {...register('name', { required: true, onChange: onNameChange })}
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
          {suggestions.map((food) => {
            const key = foodCandidateKey(food);
            const selected = key === selectedKey;
            return (
              <button
                key={key}
                type="button"
                data-track="食品名の候補を選択"
                aria-pressed={selected}
                className="hover:bg-muted/80 aria-pressed:border-primary aria-pressed:bg-primary/5 w-full rounded-md border p-2 text-left transition-colors"
                onClick={() => {
                  onSelect(food);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{food.name}</p>
                  {selected && (
                    <span className="text-primary inline-flex shrink-0 items-center gap-1 text-xs">
                      <Check className="size-3.5" aria-hidden="true" /> 選択中
                    </span>
                  )}
                </div>
                <PfcMacroLine food={food} />
                {food.store && (
                  <p className="text-muted-foreground text-xs">{food.store}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
