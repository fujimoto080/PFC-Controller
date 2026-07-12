import { cn } from '@/lib/utils';
import type { FoodItem } from '@/lib/types';

interface PfcMacroLineProps {
  food: Pick<FoodItem, 'protein' | 'fat' | 'carbs' | 'calories'>;
  /** カロリーを ` | Nkcal` として表示するか（既定 true） */
  showCalories?: boolean;
  /** 小数桁。未指定なら値をそのまま表示する */
  precision?: number;
  className?: string;
}

/** `P:x F:y C:z | Nkcal` 形式の栄養素 1 行表示。食品リスト各所で共通利用する。 */
export function PfcMacroLine({
  food,
  showCalories = true,
  precision,
  className,
}: PfcMacroLineProps) {
  const fmt = (value: number) =>
    precision === undefined ? String(value) : value.toFixed(precision);

  return (
    <div className={cn('text-muted-foreground text-xs', className)}>
      P:{fmt(food.protein)} F:{fmt(food.fat)} C:{fmt(food.carbs)}
      {showCalories && ` | ${fmt(food.calories)}kcal`}
    </div>
  );
}
