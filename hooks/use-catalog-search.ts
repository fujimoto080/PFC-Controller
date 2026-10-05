'use client';

import { useEffect, useState } from 'react';
import type { BarcodeFood } from '@/lib/barcode';
import { searchCatalogFoods } from '@/lib/client/api';
import { toast } from '@/lib/toast';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 400;

interface Searched {
  query: string;
  source: 'catalog' | 'kalori';
  foods: BarcodeFood[];
}

/**
 * 公式サイトのカタログ、無ければ Kalori から商品を探す。入力が止まってから引く。
 * enabled が false の間（過去の記録などで足りているとき）は引かない。
 */
export function useCatalogSearch(query: string, enabled: boolean) {
  const trimmed = query.trim();
  const active = enabled && trimmed.length >= MIN_QUERY_LENGTH;
  const [searched, setSearched] = useState<Searched | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchCatalogFoods(trimmed)
        .then((result) => {
          if (!cancelled) setSearched({ query: trimmed, ...result });
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          toast.fromError('商品の検索に失敗しました', error);
          setSearched({ query: trimmed, source: 'catalog', foods: [] });
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, trimmed]);

  const done = active && searched?.query === trimmed;
  return {
    loading: active && !done,
    source: done ? searched.source : undefined,
    foods: done ? searched.foods : [],
  };
}
