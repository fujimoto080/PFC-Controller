'use client';

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { Button } from '@/components/ui/button';
import { addFoodItem } from '@/lib/client/actions';
import { toast } from '@/lib/toast';
import type { MealSuggestionOption } from '@/lib/types';

/** 提案 1 案。食べたら「記録する」で全品を今の時刻で記録できる。 */
export function SuggestionOptionCard({
  option,
}: {
  option: MealSuggestionOption;
}) {
  const [logged, setLogged] = useState(false);

  const logAll = async () => {
    const timestamp = Date.now();
    const results = await Promise.all(
      option.items.map((item) =>
        addFoodItem({ ...item, store: option.store || undefined, timestamp }),
      ),
    );
    if (results.every(Boolean)) {
      setLogged(true);
      toast.success(`${option.store}の${option.items.length}品を記録しました`);
    }
  };

  return (
    <article className="bg-card space-y-2 rounded-xl border p-4">
      <header className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 font-semibold">{option.store}</h3>
        {option.hasNewProduct && (
          <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
            新商品
          </span>
        )}
      </header>
      <ul className="space-y-1">
        {option.items.map((item, index) => (
          <li key={index} className="flex items-baseline gap-2 text-sm">
            <span className="min-w-0 flex-1">{item.name}</span>
            <PfcMacroLine food={item} className="shrink-0" />
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 border-t pt-2">
        <PfcMacroLine
          food={option.total}
          precision={0}
          className="text-foreground flex-1 text-sm font-medium"
        />
        <Button
          size="sm"
          variant={logged ? 'ghost' : 'outline'}
          disabled={logged}
          onClick={() => {
            void logAll();
          }}
        >
          {logged ? <Check /> : <Plus />}
          {logged ? '記録済み' : '記録する'}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{option.reason}</p>
    </article>
  );
}
