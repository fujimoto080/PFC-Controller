'use client';

import { useEffect, useState } from 'react';
import { getAllLogItems } from '@/lib/storage';
import { FoodItem } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

export function LogList() {
  const [allItems, setAllItems] = useState<FoodItem[]>([]);
  const [displayCount, setDisplayCount] = useState(100);

  useEffect(() => {
    setAllItems(getAllLogItems());
  }, []);

  if (allItems.length === 0) {
    return (
      <div className="text-muted-foreground py-10 text-center">
        <p>記録はありません。</p>
      </div>
    );
  }

  const itemsToShow = allItems.slice(0, displayCount);
  const hasMore = allItems.length > displayCount;

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="space-y-2 px-1">
        {itemsToShow.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <h3 className="text-sm font-medium">{item.name}</h3>
                <div className="text-muted-foreground mt-0.5 flex gap-2 text-xs">
                  <span>{item.calories} kcal</span>
                  <span>P:{item.protein}</span>
                  <span>F:{item.fat}</span>
                  <span>C:{item.carbs}</span>
                </div>
                <div className="text-muted-foreground mt-0.5 text-[10px]">
                  {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {hasMore && (
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
  );
}
