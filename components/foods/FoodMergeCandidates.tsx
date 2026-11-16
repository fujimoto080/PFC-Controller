import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { Button } from '@/components/ui/button';
import type { findFoodMergeCandidates } from '@/lib/food-suggestions';

interface FoodMergeCandidatesProps {
  candidates: ReturnType<typeof findFoodMergeCandidates>;
  onSelect: (ids: string[]) => void;
}

export function FoodMergeCandidates({
  candidates,
  onSelect,
}: FoodMergeCandidatesProps) {
  return (
    <section className="space-y-2" aria-label="名寄せ候補">
      <h2 className="text-sm font-semibold">名寄せ候補（PFC一致）</h2>
      {candidates.length === 0 && (
        <p className="text-muted-foreground text-sm">
          PFCが一致する食品はありません
        </p>
      )}
      {candidates.map(({ key, foods }) => (
        <div key={key} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <PfcMacroLine food={foods[0]} showCalories={false} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onSelect(foods.map(({ id }) => id));
              }}
            >
              この組を選択
            </Button>
          </div>
          <ul className="space-y-1">
            {foods.map((food) => (
              <li key={food.id} className="text-sm">
                {food.name}
                <span className="text-muted-foreground ml-2 text-xs">
                  {food.store && `${food.store} / `}
                  {food.calories} kcal
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
