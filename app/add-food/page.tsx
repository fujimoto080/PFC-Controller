'use client';

import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FoodSearch } from '@/components/record/AddFoodDrawer';
import { RecordStepView, type RecordStep } from '@/components/record/RecordDrawer';
import { foodCandidateKey } from '@/lib/food-suggestions';
import { defaultTimestampFor, formatDate } from '@/lib/utils';

/**
 * Searching is a persistent page, not a swipe-dismissable sheet.
 * Keep the search subtree mounted while editing so its filters and scroll
 * position survive going back without synthetic keyboard/touch heuristics.
 */
function AddFoodFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const date = params.get('date') || formatDate(Date.now());
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<RecordStep | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);

  const backToSearch = () => {
    setSelection(null);
    requestAnimationFrame(() => {
      if (searchRef.current) searchRef.current.scrollTop = scrollTop.current;
    });
  };

  return (
    <section className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b pb-3">
        <Button
          variant="ghost"
          onClick={() => (selection ? backToSearch() : router.back())}
          aria-label="戻る"
        >
          <ArrowLeft />
          戻る
        </Button>
        <h1 className="font-semibold">
          {selection ? '摂取を記録' : '食品を検索'}
        </h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label="閉じる"
          onClick={() => router.push('/')}
        >
          <X />
        </Button>
      </header>
      <div
        ref={searchRef}
        hidden={selection !== null}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-3"
      >
        <FoodSearch
          query={query}
          selectedKey={selectedKey}
          onQueryChange={setQuery}
          onSelect={(step) => {
            scrollTop.current = searchRef.current?.scrollTop ?? 0;
            setSelectedKey(step.food ? foodCandidateKey(step.food) : null);
            setSelection(step);
          }}
        />
      </div>
      {selection && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-3">
          <Button variant="outline" className="mb-3 w-full" onClick={backToSearch}>
            別の食品を選ぶ
          </Button>
          <RecordStepView
            step={selection}
            timestamp={defaultTimestampFor(date)}
            onDone={() => router.push('/')}
          />
        </div>
      )}
    </section>
  );
}

export default function AddFoodPage() {
  return (
    <Suspense fallback={null}>
      <AddFoodFlow />
    </Suspense>
  );
}
