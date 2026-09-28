'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { NearbyStore } from '@/lib/types';
import { toggleItem } from '@/lib/utils';

/** 近くのお店から提案に使うお店を選ぶ。栄養公開チェーン・近い順に並んでいる。 */
export function StorePicker({
  stores,
  onSubmit,
}: {
  stores: NearbyStore[];
  onSubmit: (stores: NearbyStore[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <section className="space-y-2 rounded-xl border p-3">
      <ul className="max-h-72 divide-y overflow-y-auto">
        {stores.map((store) => (
          <li key={store.id} className="flex items-center gap-3 py-2 text-sm">
            <Checkbox
              id={`store-${store.id}`}
              data-track="お店を選択"
              checked={selectedIds.includes(store.id)}
              onCheckedChange={() => {
                setSelectedIds((ids) => toggleItem(ids, store.id));
              }}
            />
            <label htmlFor={`store-${store.id}`} className="min-w-0 flex-1">
              <span className="block truncate">{store.name}</span>
              <span className="text-muted-foreground text-xs">
                {store.category}・{store.near}から{store.distanceM}m
                {store.isChain && '・栄養公開'}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Button
        className="w-full"
        disabled={selectedIds.length === 0}
        onClick={() => {
          onSubmit(stores.filter((store) => selectedIds.includes(store.id)));
        }}
      >
        選んだ{selectedIds.length}店で提案
      </Button>
    </section>
  );
}
