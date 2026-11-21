'use client';

import { useMemo } from 'react';
import { useCatalogSearch } from '@/hooks/use-catalog-search';
import { useAppState } from '@/lib/client/store';
import { createFoodCandidateSearch, foodCandidateKey } from '@/lib/food-suggestions';

/** 過去の記録・食品リスト → JSON カタログ → Kalori の順に食品を探す。 */
export function useFoodSearch(query: string) {
  const { foods, logs, foodAliases } = useAppState();
  const searchCandidates = useMemo(
    () => createFoodCandidateSearch(foods, logs, foodAliases),
    [foods, logs, foodAliases],
  );
  const candidates = useMemo(
    () => searchCandidates(query),
    [searchCandidates, query],
  );
  const catalog = useCatalogSearch(query, true);
  const combined = useMemo(() => {
    const seen = new Set(candidates.map(foodCandidateKey));
    return [...candidates, ...catalog.foods.filter((food) => {
      const key = foodCandidateKey(food);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })];
  }, [candidates, catalog.foods]);

  return {
    foods: combined,
    source: candidates.length > 0 ? ('history' as const) : catalog.source,
    loading: catalog.loading && combined.length === 0,
  };
}
