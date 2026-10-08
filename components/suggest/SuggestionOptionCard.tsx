'use client';

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { Button } from '@/components/ui/button';
import {
  FoodBatchFlow,
  type FoodBatchView,
} from '@/components/record/FoodBatchFlow';
import { useScanBatch } from '@/hooks/use-scan-batch';
import type { MealSuggestionOption } from '@/lib/types';

/** 提案の全商品を共通の一括登録フローで確認・修正して保存する。 */
export function SuggestionOptionCard({
  option,
}: {
  option: MealSuggestionOption;
}) {
  const [logged, setLogged] = useState(false);

  const [view, setView] = useState<FoodBatchView>(null);
  const batch = useScanBatch(
    'pfc_suggestion:' +
      option.store +
      ':' +
      option.items.map((item) => item.name).join('|'),
  );
  const open = () => {
    if (batch.items.length === 0)
      batch.addFoods(
        option.items.map((item) => ({
          ...item,
          store: option.store || undefined,
        })),
      );
    setView('review');
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
          className="text-foreground flex-1 text-sm font-medium"
        />
        <Button
          size="sm"
          variant={logged ? 'ghost' : 'outline'}
          disabled={logged}
          onClick={() => {
            open();
          }}
        >
          {logged ? <Check /> : <Plus />}
          {logged ? '記録済み' : '記録する'}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{option.reason}</p>
      <FoodBatchFlow
        batch={batch}
        view={view}
        onViewChange={setView}
        onSaved={() => {
          setLogged(true);
        }}
      />
    </article>
  );
}
