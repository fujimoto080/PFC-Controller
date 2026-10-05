'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { useAppState } from '@/lib/client/store';
import type { FoodItem } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { useEverOpen } from '@/hooks/use-ever-open';

// 編集シートは重いため、初めて開くまで読み込まない
const EditLogItemDrawer = dynamic(() =>
  import('./EditLogItemDrawer').then((m) => m.EditLogItemDrawer),
);

interface DayLogListProps {
  date: string;
  onAdd: () => void;
}

/** 選択日に食べたものを時刻順に並べる。タップで編集・削除できる。 */
export function DayLogList({ date, onAdd }: DayLogListProps) {
  const { logs } = useAppState();
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const editMounted = useEverOpen(editingItem !== null);
  const items = [...(logs[date]?.items ?? [])].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">
        食べたもの
        {items.length > 0 && (
          <span className="text-muted-foreground ml-1.5 text-xs font-normal">
            {items.length}件
          </span>
        )}
      </h2>

      {items.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="text-muted-foreground hover:bg-muted/50 w-full rounded-lg border border-dashed py-8 text-sm"
        >
          まだ記録がありません
        </button>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                data-track="食事の記録を編集"
                className="hover:bg-muted/60 flex w-full items-center gap-3 px-3 py-2.5 text-left"
                onClick={() => {
                  setEditingItem(item);
                }}
              >
                <span className="text-muted-foreground w-10 shrink-0 text-xs tabular-nums">
                  {formatTime(item.timestamp)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.name}
                  </span>
                  <PfcMacroLine food={item} showCalories={false} />
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {item.calories}
                  <span className="text-muted-foreground ml-0.5 text-xs font-normal">
                    kcal
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editMounted && (
        <EditLogItemDrawer
          item={editingItem}
          onClose={() => {
            setEditingItem(null);
          }}
        />
      )}
    </section>
  );
}
