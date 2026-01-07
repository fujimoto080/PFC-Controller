'use client';

import { useEffect, useState, useCallback } from 'react';
import { Edit2, Plus } from 'lucide-react';
import { getAllLogItems, addFoodItem } from '@/lib/storage';
import { FoodItem } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { toast } from 'sonner';
import { EditLogItemDrawer } from './EditLogItemDrawer';
import { AddFoodForm } from '@/components/input/AddFoodForm';

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
    refreshItems();
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
      id: Date.now().toString(),
      timestamp: Date.now(),
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
        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="space-y-2 px-1 pb-40">
            {allItems.slice(0, displayCount).map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="space-y-3 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">{item.name}</h3>
                      <div className="text-muted-foreground mt-0.5 text-[10px]">
                        {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEditClick(item)}
                      className="h-8 w-8 text-muted-foreground"
                      title="編集"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="text-muted-foreground flex gap-2 text-xs">
                    <span>{item.calories} kcal</span>
                    <span>P:{item.protein}</span>
                    <span>F:{item.fat}</span>
                    <span>C:{item.carbs}</span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCallClick(item)}
                      className="h-8 flex-1 text-xs"
                    >
                      呼び出し
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReRegisterClick(item)}
                      className="h-8 flex-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                    >
                      再登録
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

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
