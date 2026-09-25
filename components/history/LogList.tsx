'use client';

import { useMemo, useState } from 'react';
import { Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { logFood } from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';
import { sumPFC } from '@/lib/pfc';
import type { FoodItem, Logs, PFC } from '@/lib/types';
import { cn, formatDate, formatTime, toggleItem } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { toast } from '@/lib/toast';
import { EditLogItemDrawer } from './EditLogItemDrawer';
import { AddFoodForm } from '@/components/input/AddFoodForm';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';

const PAGE_SIZE = 100;

const TIME_OF_DAY_GRADIENTS = {
  morning:
    'bg-[linear-gradient(80deg,rgba(255,120,80,0.45)_0%,rgba(255,180,150,0.25)_5%,transparent_10%)]',
  afternoon:
    'bg-[linear-gradient(80deg,rgba(80,160,255,0.45)_0%,rgba(150,210,255,0.25)_5%,transparent_10%)]',
  evening:
    'bg-[linear-gradient(80deg,rgba(255,90,120,0.45)_0%,rgba(200,120,255,0.25)_5%,transparent_10%)]',
  night:
    'bg-[linear-gradient(80deg,rgba(80,90,255,0.45)_0%,rgba(120,100,200,0.25)_5%,transparent_10%)]',
} as const;

function timeOfDayGradient(timestamp: number): string {
  const hour = Number(formatTime(timestamp).slice(0, 2));
  if (hour >= 5 && hour < 11) return TIME_OF_DAY_GRADIENTS.morning;
  if (hour >= 11 && hour < 15) return TIME_OF_DAY_GRADIENTS.afternoon;
  if (hour >= 15 && hour < 18) return TIME_OF_DAY_GRADIENTS.evening;
  return TIME_OF_DAY_GRADIENTS.night;
}

/** 同じ日の、食品名 + PFC 値が同じ記録のまとまり。 */
interface FoodGroup {
  key: string;
  items: [FoodItem, ...FoodItem[]];
  total: PFC;
}

/** 新しい順に最大 limit 件の記録を 日付 → 同一食品 の2階層にまとめる。 */
function groupLogItems(logs: Logs, limit: number) {
  const items = Object.values(logs)
    .flatMap((log) => log.items)
    .sort((a, b) => b.timestamp - a.timestamp);

  const byDate = new Map<string, Map<string, FoodItem[]>>();
  for (const item of items.slice(0, limit)) {
    const date = formatDate(item.timestamp);
    const key = `${item.name}_${item.protein}_${item.fat}_${item.carbs}`;
    const groups = byDate.get(date) ?? new Map<string, FoodItem[]>();
    byDate.set(date, groups);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const days = Array.from(byDate, ([date, groups]) => ({
    date,
    groups: Array.from(groups, ([key, groupItems]): FoodGroup => ({
      key,
      items: groupItems as FoodGroup['items'],
      total: sumPFC(groupItems),
    })),
  }));
  return { days, hasMore: items.length > limit };
}

async function reRegister(item: FoodItem) {
  if (await logFood(item, Date.now())) {
    toast.success(`${item.name}を再登録しました`);
  }
}

export function LogList() {
  const { logs } = useAppState();
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [callingItem, setCallingItem] = useState<FoodItem | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const { days, hasMore } = useMemo(
    () => groupLogItems(logs, displayCount),
    [logs, displayCount],
  );

  return (
    <>
      <Drawer
        open={callingItem !== null}
        onOpenChange={(open) => {
          if (!open) setCallingItem(null);
        }}
      >
        <DrawerContent className="h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>データを追加</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-8">
            {callingItem && (
              <AddFoodForm
                key={callingItem.id}
                onSuccess={() => {
                  setCallingItem(null);
                }}
                initialData={callingItem}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {days.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center">
          記録はありません。
        </p>
      ) : (
        <ScrollArea className="h-[calc(100vh-160px)]">
          <div className="space-y-6 px-1 pb-20">
            {days.map(({ date, groups }) => {
              const day = parseISO(date);
              const label = format(day, 'M/d(eee)', { locale: ja });
              const today = isToday(day);

              return (
                <div key={date} className="space-y-2">
                  <h2
                    className={cn(
                      'bg-background/95 sticky top-0 z-10 px-1 py-1 text-xs font-semibold backdrop-blur',
                      today ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {today ? `今日 - ${label}` : label}
                  </h2>
                  {groups.map((group) => (
                    <LogGroupCard
                      key={group.key}
                      group={group}
                      expanded={expandedGroups.includes(group.key)}
                      onToggleExpanded={() => {
                        setExpandedGroups((prev) =>
                          toggleItem(prev, group.key),
                        );
                      }}
                      onCall={setCallingItem}
                      onEdit={setEditingItem}
                    />
                  ))}
                </div>
              );
            })}

            {hasMore && (
              <div className="flex justify-center pt-2 pb-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDisplayCount((prev) => prev + PAGE_SIZE);
                  }}
                  className="w-full"
                >
                  さらに表示
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      <EditLogItemDrawer
        item={editingItem}
        onClose={() => {
          setEditingItem(null);
        }}
      />
    </>
  );
}

interface LogGroupCardProps {
  group: FoodGroup;
  expanded: boolean;
  onToggleExpanded: () => void;
  onCall: (item: FoodItem) => void;
  onEdit: (item: FoodItem) => void;
}

function LogGroupCard({
  group,
  expanded,
  onToggleExpanded,
  onCall,
  onEdit,
}: LogGroupCardProps) {
  const [first] = group.items;
  const isSingle = group.items.length === 1;

  return (
    <Card className={cn('overflow-hidden', timeOfDayGradient(first.timestamp))}>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium">
              {first.name}
              {!isSingle && (
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  ×{group.items.length}
                </span>
              )}
            </h3>
            <div className="text-muted-foreground mt-0.5 text-[10px]">
              {group.total.calories} kcal
            </div>
          </div>
          {!isSingle && (
            <IconButton
              onClick={onToggleExpanded}
              className="text-muted-foreground h-8 w-8"
              title={expanded ? '折りたたむ' : '展開'}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </IconButton>
          )}
        </div>

        <PfcMacroLine food={group.total} showCalories={false} precision={1} />

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onCall(first);
            }}
            className="h-8 flex-1 text-xs"
          >
            呼び出し
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void reRegister(first);
            }}
            className="h-8 flex-1 border-blue-200 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          >
            再登録
          </Button>
          {isSingle && (
            <IconButton
              onClick={() => {
                onEdit(first);
              }}
              className="text-muted-foreground h-8 w-8"
              title="編集"
            >
              <Edit2 className="h-4 w-4" />
            </IconButton>
          )}
        </div>

        {!isSingle && expanded && (
          <div className="space-y-2 border-t pt-3">
            {group.items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center justify-between rounded-lg p-2',
                  timeOfDayGradient(item.timestamp),
                )}
              >
                <div className="flex-1">
                  <div className="text-muted-foreground text-xs">
                    {formatTime(item.timestamp)} • {item.calories} kcal
                  </div>
                  <PfcMacroLine
                    food={item}
                    showCalories={false}
                    precision={1}
                    className="mt-1 text-[10px]"
                  />
                </div>
                <IconButton
                  onClick={() => {
                    onEdit(item);
                  }}
                  className="text-muted-foreground h-7 w-7"
                  title="編集"
                >
                  <Edit2 className="h-3 w-3" />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
