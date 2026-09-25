'use client';

import { useState } from 'react';
import { Check, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FoodTemplate } from '@/lib/food-form';
import { MACROS } from '@/lib/macros';
import { scalePFC } from '@/lib/pfc';
import { cn, roundPFC } from '@/lib/utils';

const FACTORS = [0.5, 1, 1.5, 2] as const;

interface ConfirmFoodProps {
  food: FoodTemplate;
  onRecord: (food: FoodTemplate) => void;
  onEdit: () => void;
}

/** 選んだ食品の栄養値と数量を確認して 1 タップで記録する。 */
export function ConfirmFood({ food, onRecord, onEdit }: ConfirmFoodProps) {
  const [factor, setFactor] = useState<number>(1);
  const scaled = scalePFC(food, factor);

  return (
    <div className="space-y-5">
      <div>
        {food.store && (
          <p className="text-muted-foreground text-xs">{food.store}</p>
        )}
        <p className="text-lg leading-snug font-semibold">{food.name}</p>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <NutrientTile
          label="kcal"
          value={roundPFC(scaled.calories, 0)}
          className="bg-primary text-primary-foreground"
        />
        {MACROS.map(({ key, short }) => (
          <NutrientTile
            key={key}
            label={`${short} (g)`}
            value={roundPFC(scaled[key], 1)}
            className="bg-muted"
          />
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">数量</p>
        <div className="grid grid-cols-4 gap-2">
          {FACTORS.map((value) => (
            <Button
              key={value}
              type="button"
              variant={factor === value ? 'default' : 'outline'}
              onClick={() => {
                setFactor(value);
              }}
            >
              ×{value}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Button
          size="lg"
          className="h-12 w-full text-base"
          onClick={() => {
            onRecord(scaled);
          }}
        >
          <Check /> 記録する
        </Button>
        <Button variant="ghost" className="w-full" onClick={onEdit}>
          <PenLine /> 内容を修正して記録
        </Button>
      </div>
    </div>
  );
}

function NutrientTile({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={cn('rounded-lg px-1 py-2', className)}>
      <p className="text-lg leading-tight font-bold tabular-nums">{value}</p>
      <p className="text-[10px] opacity-70">{label}</p>
    </div>
  );
}
