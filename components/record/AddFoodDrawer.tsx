'use client';

import { useMemo, useState } from 'react';
import { PenLine, Search } from 'lucide-react';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppState } from '@/lib/client/store';
import { searchFoodCandidates } from '@/lib/food-suggestions';
import { defaultTimestampFor } from '@/lib/utils';
import { RecordDrawer, RecordStepView, type RecordStep } from './RecordDrawer';

interface AddFoodDrawerProps {
  open: boolean;
  /** 記録先の日付 (YYYY-MM-DD) */
  date: string;
  onClose: () => void;
}

const TITLES = {
  search: '食事を記録',
  confirm: '内容を確認',
  form: '栄養を入力',
} as const;

/** 過去の記録・食品リストから選んで記録するか、新しく入力して記録するシート。 */
interface Selection {
  step: RecordStep;
  timestamp: number;
}

export function AddFoodDrawer({ open, date, onClose }: AddFoodDrawerProps) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [query, setQuery] = useState('');

  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      onClosed={() => {
        setSelection(null);
        setQuery('');
      }}
      title={TITLES[selection?.step.kind ?? 'search']}
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
          onStepChange={(step) => {
            setSelection({ ...selection, step });
          }}
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
  const { foods, logs } = useAppState();
  const candidates = useMemo(
    () => searchFoodCandidates(foods, logs, query),
    [foods, logs, query],
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
          }}
          placeholder="過去の記録・食品リストを検索"
          className="pl-9"
          aria-label="食品を検索"
        />
      </div>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          onSelect({ kind: 'form' });
        }}
      >
        <PenLine /> 新しく入力する
      </Button>

      <p className="text-muted-foreground pt-1 text-xs">
        {query ? '検索結果' : '最近食べたもの'}
      </p>
      {candidates.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          見つかりませんでした
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {candidates.map((food) => (
            <li key={food.id}>
              <button
                type="button"
                className="hover:bg-muted/60 w-full px-3 py-2.5 text-left"
                onClick={() => {
                  onSelect({ kind: 'confirm', food });
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
      )}
    </div>
  );
}
