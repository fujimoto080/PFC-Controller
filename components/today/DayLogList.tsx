'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { Button } from '@/components/ui/button';
import { useAppState } from '@/lib/client/store';
import type { FoodItem } from '@/lib/types';
import { formatTime, roundPFC } from '@/lib/utils';
import { EditLogItemDrawer } from './EditLogItemDrawer';

interface DayLogListProps {
  date: string;
  onAdd: () => void;
}

/** 選択日に食べたものを時刻順に並べる。タップで編集・削除できる。 */
export function DayLogList({ date, onAdd }: DayLogListProps) {
  const { logs } = useAppState();
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const items = [...(logs[date]?.items ?? [])].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          食べたもの
          {items.length > 0 && (
            <span className="text-muted-foreground ml-1.5 text-xs font-normal">
              {items.length}件
            </span>
          )}
        </h2>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus /> 追加
        </Button>
      </div>

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
                  <PfcMacroLine
                    food={item}
                    showCalories={false}
                    precision={1}
                  />
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {roundPFC(item.calories, 0)}
                  <span className="text-muted-foreground ml-0.5 text-xs font-normal">
                    kcal
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <EditLogItemDrawer
        item={editingItem}
        onClose={() => {
          setEditingItem(null);
        }}
      />
    </section>
  );
}
