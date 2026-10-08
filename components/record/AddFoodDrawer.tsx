'use client';

import { useState } from 'react';
import { Loader2, PenLine, Search, Sparkles } from 'lucide-react';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAiNutrition } from '@/hooks/use-ai-nutrition';
import { useFoodSearch } from '@/hooks/use-food-search';
import type { BarcodeFood } from '@/lib/barcode';
import type { FoodItem } from '@/lib/types';
import { defaultTimestampFor } from '@/lib/utils';
import { RecordDrawer, RecordStepView, type RecordStep } from './RecordDrawer';
import { StatusMessage } from '@/components/ui/status-message';

interface AddFoodDrawerProps {
  open: boolean;
  /** 記録先の日付 (YYYY-MM-DD) */
  date: string;
  /** 開いたときに最初に出す画面。未指定なら検索から始める。 */
  initialStep?: RecordStep;
  onClose: () => void;
}

/** 過去の記録・食品リストから選んで記録するか、新しく入力して記録するシート。 */
interface Selection {
  step: RecordStep;
  timestamp: number;
}

export function AddFoodDrawer({
  open,
  date,
  initialStep,
  onClose,
}: AddFoodDrawerProps) {
  const [selection, setSelection] = useState<Selection | null>(() =>
    open && initialStep
      ? { step: initialStep, timestamp: defaultTimestampFor(date) }
      : null,
  );
  const [query, setQuery] = useState('');
  const [wasOpen, setWasOpen] = useState(open);
  // 開いた瞬間に、指定された画面から始める
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && initialStep) {
      setSelection({ step: initialStep, timestamp: defaultTimestampFor(date) });
    }
  }

  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      onClosed={() => {
        setSelection(null);
        setQuery('');
      }}
      title={selection ? '食品を登録・記録' : '食品を検索'}
      onBack={
        selection
          ? () => {
              setSelection(null);
            }
          : undefined
      }
    >
      {selection ? (
        <RecordStepView
          step={selection.step}
          timestamp={selection.timestamp}
          onDone={onClose}
        />
      ) : (
        <FoodSearch
          query={query}
          onQueryChange={setQuery}
          onSelect={(step) => {
            setSelection({ step, timestamp: defaultTimestampFor(date) });
          }}
        />
      )}
    </RecordDrawer>
  );
}

function FoodSearch({
  query,
  onQueryChange,
  onSelect,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (step: RecordStep) => void;
}) {
  const search = useFoodSearch(query);
  const ai = useAiNutrition((food) => {
    onSelect({ food });
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
          }}
          placeholder="食品名・店名で検索"
          className="pl-9"
          aria-label="食品を検索"
        />
      </div>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          onSelect({});
        }}
      >
        <PenLine /> 新しく入力する
      </Button>
      {query.trim() && (
        <Button
          variant="outline"
          className="w-full"
          disabled={ai.pending !== null}
          onClick={() => {
            void ai.estimate(query);
          }}
        >
          {ai.pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Sparkles className="text-primary" />
          )}
          <span className="truncate">「{query.trim()}」をAIで推定</span>
        </Button>
      )}

      <p className="text-muted-foreground pt-1 text-xs">
        {query ? '検索結果' : '最近食べたもの'}
      </p>
      {search.loading ? (
        <StatusMessage>商品を探しています…</StatusMessage>
      ) : search.foods.length > 0 ? (
        <>
          {search.source !== 'history' && (
            <p className="text-muted-foreground text-xs">
              {search.source === 'kalori'
                ? 'Kalori のカタログ'
                : '店舗・メーカーのカタログ'}
            </p>
          )}
          <FoodList foods={search.foods} onSelect={onSelect} />
        </>
      ) : (
        <StatusMessage>見つかりませんでした</StatusMessage>
      )}
    </div>
  );
}

function FoodList({
  foods,
  onSelect,
}: {
  foods: readonly (BarcodeFood & Pick<FoodItem, 'storeGroup'>)[];
  onSelect: (step: RecordStep) => void;
}) {
  return (
    <ul className="divide-y rounded-lg border">
      {foods.map((food) => (
        <li key={`${food.store ?? ''}|${food.name}|${food.calories}`}>
          <button
            type="button"
            data-track="検索結果の食品を選択"
            className="hover:bg-muted/60 w-full px-3 py-2.5 text-left"
            onClick={() => {
              onSelect({ food });
            }}
          >
            <p className="text-sm font-medium">{food.name}</p>
            <PfcMacroLine food={food} />
            {food.store && (
              <p className="text-muted-foreground text-xs">{food.store}</p>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
