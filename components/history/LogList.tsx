'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { getAllLogItems, addFoodItem } from '@/lib/storage';
import { FoodItem } from '@/lib/types';
import { generateId, cn, getTimeOfDayGradient } from '@/lib/utils';
import { format, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { toast } from 'sonner';
import { EditLogItemDrawer } from './EditLogItemDrawer';
import { AddFoodForm } from '@/components/input/AddFoodForm';

const getCurrentTimestamp = () => Date.now();

type GroupedFoodItem = {
  name: string;
  count: number;
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  items: FoodItem[];
  // グループのキー（食品名+PFC値）
  groupKey: string;
};

export function LogList() {
  const [allItems, setAllItems] = useState<FoodItem[]>([]);
  const [displayCount, setDisplayCount] = useState(100);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);

  const refreshItems = useCallback(() => {
    setAllItems(getAllLogItems());
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      refreshItems();
    });
  }, [refreshItems]);

  const handleEditClick = (item: FoodItem) => {
    setEditingItem(item);
    setIsEditDrawerOpen(true);
  };

  const handleCallClick = (item: FoodItem) => {
    // Open drawer with this item's data to allow editing
    setCallingItem(item);
    setIsAddDrawerOpen(true);
  };

  const handleReRegisterClick = (item: FoodItem) => {
    const newItem: FoodItem = {
      ...item,
      id: generateId(),
      timestamp: getCurrentTimestamp(),
    };
    addFoodItem(newItem);
    toast.success(`${item.name}を再登録しました`);
    refreshItems();
  };

  const handleAddSuccess = () => {
    setIsAddDrawerOpen(false);
    setCallingItem(null);
    refreshItems();
  };

  const [callingItem, setCallingItem] = useState<FoodItem | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Group items by date, then by food (name + PFC)
  const groupedItems = useMemo(() => {
    const dateGroups: Record<string, Record<string, GroupedFoodItem>> = {};
    
    allItems.slice(0, displayCount).forEach((item) => {
      const dateKey = new Date(item.timestamp).toISOString().split('T')[0];
      // 食品名とPFC値でグループキーを作成
      const groupKey = `${item.name}_${item.protein}_${item.fat}_${item.carbs}`;
      
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = {};
      }
      
      if (!dateGroups[dateKey][groupKey]) {
        dateGroups[dateKey][groupKey] = {
          name: item.name,
          count: 0,
          totalCalories: 0,
          totalProtein: 0,
          totalFat: 0,
          totalCarbs: 0,
          items: [],
          groupKey,
        };
      }
      
      const group = dateGroups[dateKey][groupKey];
      group.count++;
      group.totalCalories += item.calories;
      group.totalProtein += item.protein;
      group.totalFat += item.fat;
      group.totalCarbs += item.carbs;
      group.items.push(item);
    });
    
    return dateGroups;
  }, [allItems, displayCount]);

  const sortedDateKeys = useMemo(() => {
    return Object.keys(groupedItems).sort((a, b) => b.localeCompare(a));
  }, [groupedItems]);

  return (
    <div className="space-y-4">
      <Drawer open={isAddDrawerOpen} onOpenChange={(open) => {
        setIsAddDrawerOpen(open);
        if (!open) setCallingItem(null);
      }}>
        <DrawerContent className="h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>データを追加</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto">
            <AddFoodForm onSuccess={handleAddSuccess} initialData={callingItem || undefined} />
          </div>
        </DrawerContent>
      </Drawer>

      {allItems.length === 0 ? (
        <div className="text-muted-foreground py-10 text-center">
          <p>記録はありません。</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-160px)]">
          <div className="space-y-6 px-1 pb-20">
            {sortedDateKeys.map((dateKey) => {
              const dateItems = groupedItems[dateKey];
              const date = new Date(dateKey);
              const formattedDate = format(date, 'M/d(eee)', { locale: ja });
              const isItemToday = isToday(date);

              return (
                  <div key={dateKey} className="space-y-2">
                    <h2 className={cn(
                      "text-xs font-semibold px-1 py-1 sticky top-0 bg-background/95 backdrop-blur z-10",
                      isItemToday ? "text-primary" : "text-muted-foreground"
                    )}>
                      {isItemToday ? `今日 - ${formattedDate}` : formattedDate}
                    </h2>
                    <div className="space-y-2">
                      {Object.values(dateItems).map((group) => {
                        const isExpanded = expandedGroups.has(group.groupKey);
                        const isSingleItem = group.count === 1;
                        
                        return (
                          <Card 
                            key={group.groupKey} 
                            className={cn(
                              "overflow-hidden",
                              getTimeOfDayGradient(group.items[0].timestamp)
                            )}
                          >
                            <CardContent className="space-y-3 p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h3 className="text-sm font-medium">
                                    {group.name}
                                    {!isSingleItem && (
                                      <span className="text-muted-foreground ml-2 text-xs font-normal">
                                        ×{group.count}
                                      </span>
                                    )}
                                  </h3>
                                  <div className="text-muted-foreground mt-0.5 text-[10px]">
                                    {group.totalCalories} kcal
                                  </div>
                                </div>
                                {!isSingleItem && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => toggleGroup(group.groupKey)}
                                    className="h-8 w-8 text-muted-foreground"
                                    title={isExpanded ? "折りたたむ" : "展開"}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>

                              <div className="text-muted-foreground flex gap-2 text-xs">
                                <span>P:{group.totalProtein.toFixed(1)}</span>
                                <span>F:{group.totalFat.toFixed(1)}</span>
                                <span>C:{group.totalCarbs.toFixed(1)}</span>
                              </div>

                              {/* グループ全体の操作ボタン */}
                              <div className="flex gap-2 pt-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCallClick(group.items[0])}
                                  className="h-8 flex-1 text-xs"
                                >
                                  呼び出し
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReRegisterClick(group.items[0])}
                                  className="h-8 flex-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                >
                                  再登録
                                </Button>
                                {isSingleItem && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleEditClick(group.items[0])}
                                    className="h-8 w-8 text-muted-foreground"
                                    title="編集"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>

                              {/* 複数アイテムの場合は展開時に個別エントリを表示 */}
                              {!isSingleItem && isExpanded && (
                                <div className="border-t pt-3 space-y-2">
                                  {group.items.map((item) => (
                                    <div 
                                      key={item.id} 
                                      className={cn(
                                        "rounded-lg p-2 space-y-2",
                                        getTimeOfDayGradient(item.timestamp)
                                      )}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="text-xs text-muted-foreground">
                                            {format(new Date(item.timestamp), 'HH:mm')} • {item.calories} kcal
                                          </div>
                                          <div className="text-muted-foreground flex gap-2 text-[10px] mt-1">
                                            <span>P:{item.protein}</span>
                                            <span>F:{item.fat}</span>
                                            <span>C:{item.carbs}</span>
                                          </div>
                                        </div>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => handleEditClick(item)}
                                          className="h-7 w-7 text-muted-foreground"
                                          title="編集"
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </Button>
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
                  onClick={() => setDisplayCount(prev => prev + 100)}
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
        open={isEditDrawerOpen}
        onOpenChange={setIsEditDrawerOpen}
        onSuccess={refreshItems}
      />
    </div>
  );
}
