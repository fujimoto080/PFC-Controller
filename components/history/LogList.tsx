'use client';

import { useMemo, useState } from 'react';
import { Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { logFood } from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';
import { sumPFC } from '@/lib/pfc';
import type { FoodItem, PFC } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { format, isToday, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
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

const TIME_OF_DAY_GRADIENT_MAP = {
  morning:
    'bg-[linear-gradient(80deg,rgba(255,120,80,0.45)_0%,rgba(255,180,150,0.25)_5%,transparent_10%)]',
  afternoon:
    'bg-[linear-gradient(80deg,rgba(80,160,255,0.45)_0%,rgba(150,210,255,0.25)_5%,transparent_10%)]',
  evening:
    'bg-[linear-gradient(80deg,rgba(255,90,120,0.45)_0%,rgba(200,120,255,0.25)_5%,transparent_10%)]',
  night:
    'bg-[linear-gradient(80deg,rgba(80,90,255,0.45)_0%,rgba(120,100,200,0.25)_5%,transparent_10%)]',
} as const;

function getTimeOfDayGradient(timestamp: number): string {
  const hour = new Date(timestamp).getHours();
  if (hour >= 5 && hour < 11) return TIME_OF_DAY_GRADIENT_MAP.morning;
  if (hour >= 11 && hour < 15) return TIME_OF_DAY_GRADIENT_MAP.afternoon;
  if (hour >= 15 && hour < 18) return TIME_OF_DAY_GRADIENT_MAP.evening;
  return TIME_OF_DAY_GRADIENT_MAP.night;
}

interface GroupedFoodItem {
  // 食品名 + PFC 値が同じ記録をまとめる
  groupKey: string;
  name: string;
  items: FoodItem[];
  total: PFC;
}

async function reRegister(item: FoodItem) {
  if (await logFood(item, Date.now())) {
    toast.success(`${item.name}を再登録しました`);
  }
}

export function LogList() {
  const { logs } = useAppState();
  const allItems = useMemo(
    () =>
      Object.values(logs)
        .flatMap((log) => log.items)
        .sort((a, b) => b.timestamp - a.timestamp),
    [logs],
  );
  const [displayCount, setDisplayCount] = useState(100);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [callingItem, setCallingItem] = useState<FoodItem | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (!next.delete(groupKey)) next.add(groupKey);
      return next;
    });
  };

  // 日付 → 食品(名前 + PFC) の2階層にまとめる。日付は新しい順。
  const dateGroups = useMemo(() => {
    const byDate = new Map<string, Map<string, FoodItem[]>>();
    for (const item of allItems.slice(0, displayCount)) {
      const dateKey = formatDate(item.timestamp);
      const groupKey = `${item.name}_${item.protein}_${item.fat}_${item.carbs}`;
      const day = byDate.get(dateKey) ?? new Map<string, FoodItem[]>();
      byDate.set(dateKey, day);
      day.set(groupKey, [...(day.get(groupKey) ?? []), item]);
    }
    return Array.from(byDate, ([dateKey, groups]) => ({
      dateKey,
      groups: Array.from(groups, ([groupKey, items]): GroupedFoodItem => ({
        groupKey,
        name: items[0]?.name ?? '',
        items,
        total: sumPFC(items),
      })),
    }));
  }, [allItems, displayCount]);

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
            <AddFoodForm
              onSuccess={() => {
                setCallingItem(null);
              }}
              initialData={callingItem ?? undefined}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {allItems.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center">
          記録はありません。
        </p>
      ) : (
        <ScrollArea className="h-[calc(100vh-160px)]">
          <div className="space-y-6 px-1 pb-20">
            {dateGroups.map(({ dateKey, groups }) => {
              const date = parseISO(dateKey);
              const formattedDate = format(date, 'M/d(eee)', { locale: ja });
              const isItemToday = isToday(date);

              return (
                <div key={dateKey} className="space-y-2">
                  <h2
                    className={cn(
                      'bg-background/95 sticky top-0 z-10 px-1 py-1 text-xs font-semibold backdrop-blur',
                      isItemToday ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {isItemToday ? `今日 - ${formattedDate}` : formattedDate}
                  </h2>
                  <div className="space-y-2">
                    {groups.map((group) => {
                      const isExpanded = expandedGroups.has(group.groupKey);
                      const isSingleItem = group.items.length === 1;
                      const firstItem = group.items[0];
                      if (!firstItem) return null;

                      return (
                        <Card
                          key={group.groupKey}
                          className={cn(
                            'overflow-hidden',
                            getTimeOfDayGradient(firstItem.timestamp),
                          )}
                        >
                          <CardContent className="space-y-3 p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h3 className="text-sm font-medium">
                                  {group.name}
                                  {!isSingleItem && (
                                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                                      ×{group.items.length}
                                    </span>
                                  )}
                                </h3>
                                <div className="text-muted-foreground mt-0.5 text-[10px]">
                                  {group.total.calories} kcal
                                </div>
                              </div>
                              {!isSingleItem && (
                                <IconButton
                                  onClick={() => {
                                    toggleGroup(group.groupKey);
                                  }}
                                  className="text-muted-foreground h-8 w-8"
                                  title={isExpanded ? '折りたたむ' : '展開'}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </IconButton>
                              )}
                            </div>

                            <PfcMacroLine
                              food={group.total}
                              showCalories={false}
                              precision={1}
                            />

                            {/* グループ全体の操作ボタン */}
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCallingItem(firstItem);
                                }}
                                className="h-8 flex-1 text-xs"
                              >
                                呼び出し
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  void reRegister(firstItem);
                                }}
                                className="h-8 flex-1 border-blue-200 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              >
                                再登録
                              </Button>
                              {isSingleItem && (
                                <IconButton
                                  onClick={() => {
                                    setEditingItem(firstItem);
                                  }}
                                  className="text-muted-foreground h-8 w-8"
                                  title="編集"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </IconButton>
                              )}
                            </div>

                            {/* 複数アイテムの場合は展開時に個別エントリを表示 */}
                            {!isSingleItem && isExpanded && (
                              <div className="space-y-2 border-t pt-3">
                                {group.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className={cn(
                                      'space-y-2 rounded-lg p-2',
                                      getTimeOfDayGradient(item.timestamp),
                                    )}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="text-muted-foreground text-xs">
                                          {format(
                                            new Date(item.timestamp),
                                            'HH:mm',
                                          )}{' '}
                                          • {item.calories} kcal
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
                                          setEditingItem(item);
                                        }}
                                        className="text-muted-foreground h-7 w-7"
                                        title="編集"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </IconButton>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {allItems.length > displayCount && (
              <div className="flex justify-center pt-2 pb-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDisplayCount((prev) => prev + 100);
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
