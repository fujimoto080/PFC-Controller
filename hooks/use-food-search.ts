'use client';

import { useMemo } from 'react';
import { useCatalogSearch } from '@/hooks/use-catalog-search';
import { useAppState } from '@/lib/client/store';
import { searchFoodCandidates } from '@/lib/food-suggestions';

/** 過去の記録・食品リスト → JSON カタログ → Kalori の順に食品を探す。 */
export function useFoodSearch(query: string) {
  const { foods, logs } = useAppState();
  const candidates = useMemo(
    () => searchFoodCandidates(foods, logs, query),
    [foods, logs, query],
  );
  const catalog = useCatalogSearch(query, candidates.length === 0);

  return {
    foods: candidates.length > 0 ? candidates : catalog.foods,
    source: candidates.length > 0 ? ('history' as const) : catalog.source,
    loading: catalog.loading,
  };
}
