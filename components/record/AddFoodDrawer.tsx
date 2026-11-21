'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Loader2, PenLine, Search, Sparkles } from 'lucide-react';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAiNutrition } from '@/hooks/use-ai-nutrition';
import { useFoodSearch } from '@/hooks/use-food-search';
import { foodCandidateKey } from '@/lib/food-suggestions';
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchScrollTop = useRef(0);
  useLayoutEffect(() => {
    if (!selection && scrollRef.current) {
      scrollRef.current.scrollTop = searchScrollTop.current;
    }
  }, [selection]);
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
        setSelectedKey(null);
        searchScrollTop.current = 0;
      }}
      title={selection ? '食品を登録・記録' : '食品を検索'}
      scrollRef={scrollRef}
      onBack={
        selection
          ? () => {
              setSelection(null);
            }
          : undefined
      }
    >
      <div hidden={selection !== null}>
        <FoodSearch
          query={query}
          selectedKey={selectedKey}
          onQueryChange={setQuery}
          onSelect={(step) => {
            searchScrollTop.current = scrollRef.current?.scrollTop ?? 0;
            setSelectedKey(step.food ? foodCandidateKey(step.food) : null);
            setSelection({ step, timestamp: defaultTimestampFor(date) });
          }}
        />
      </div>
      {selection && (
        <div className="space-y-3">
          <Button variant="outline" className="w-full" onClick={() => setSelection(null)}>
            別の食品を選ぶ
          </Button>
          <RecordStepView
            step={selection.step}
            timestamp={selection.timestamp}
            onDone={onClose}
          />
        </div>
      )}
    </RecordDrawer>
  );
}

export function FoodSearch({
  query,
  selectedKey,
  onQueryChange,
  onSelect,
}: {
  query: string;
  selectedKey: string | null;
  onQueryChange: (query: string) => void;
  onSelect: (step: RecordStep) => void;
}) {
  const [storeQuery, setStoreQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const storeInputRef = useRef<HTMLInputElement>(null);
  const dismissKeyboard = () => {
    searchInputRef.current?.blur();
    storeInputRef.current?.blur();
  };
  const search = useFoodSearch(
    [storeQuery.trim(), query.trim()].filter(Boolean).join(' '),
  );
  const ai = useAiNutrition((food) => {
    onSelect({ food });
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          ref={searchInputRef}
          enterKeyHint="done"
          onKeyDown={(event) => {
            if (event.key === 'Enter') dismissKeyboard();
          }}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
          }}
          placeholder="食品名・店名で検索"
          className="pl-9"
          aria-label="食品を検索"
        />
      </div>
      <Input
        ref={storeInputRef}
        enterKeyHint="done"
        onKeyDown={(event) => {
          if (event.key === 'Enter') dismissKeyboard();
        }}
        value={storeQuery}
        onChange={(e) => setStoreQuery(e.target.value)}
        placeholder="店名で絞り込み（例: セブン）"
        aria-label="店名で絞り込み"
      />
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          dismissKeyboard();
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
        {query || storeQuery ? `検索結果（${search.foods.length}件）` : '最近食べたもの'}
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
          <FoodList
            foods={search.foods}
            selectedKey={selectedKey}
            onSelect={(step) => {
              dismissKeyboard();
              onSelect(step);
            }}
          />
        </>
      ) : (
        <StatusMessage>見つかりませんでした</StatusMessage>
      )}
    </div>
  );
}

function FoodList({
  foods,
  selectedKey,
  onSelect,
}: {
  foods: readonly (BarcodeFood & Pick<FoodItem, 'storeGroup'>)[];
  selectedKey: string | null;
  onSelect: (step: RecordStep) => void;
}) {
  return (
    <ul className="divide-y rounded-lg border">
      {foods.map((food) => (
        <li key={foodCandidateKey(food)}>
          <button
            type="button"
            data-track="検索結果の食品を選択"
            aria-pressed={foodCandidateKey(food) === selectedKey}
            className="hover:bg-muted/60 aria-pressed:bg-primary/10 aria-pressed:ring-primary w-full px-3 py-2.5 text-left aria-pressed:ring-2"
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
