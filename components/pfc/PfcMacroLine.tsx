import { cn } from '@/lib/utils';
import type { FoodItem } from '@/lib/types';

interface PfcMacroLineProps {
  food: Pick<FoodItem, 'protein' | 'fat' | 'carbs' | 'calories'>;
  /** カロリーを ` | Nkcal` として表示するか（既定 true） */
  showCalories?: boolean;
  className?: string;
}

/** `P:x F:y C:z | Nkcal` 形式の栄養素 1 行表示。食品リスト各所で共通利用する。 */
export function PfcMacroLine({
  food,
  showCalories = true,
  className,
}: PfcMacroLineProps) {
  return (
    <div className={cn('text-muted-foreground text-xs', className)}>
      P:{food.protein} F:{food.fat} C:{food.carbs}
      {showCalories && ` | ${food.calories}kcal`}
    </div>
  );
}
