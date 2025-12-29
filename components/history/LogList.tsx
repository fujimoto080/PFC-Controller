'use client';

import { useEffect, useState } from 'react';
import { getTodayLog } from '@/lib/storage';
import { DailyLog } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export function LogList() {
  const [log, setLog] = useState<DailyLog | null>(null);

  useEffect(() => {
    setLog(getTodayLog());
  }, []);

  if (!log || log.items.length === 0) {
    return (
      <div className="text-muted-foreground py-10 text-center">
        <p>今日の記録はありません。</p>
      </div>
    );
  }

  // Sort by timestamp desc
  const items = [...log.items].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="space-y-3 px-1">
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <h3 className="font-medium">{item.name}</h3>
                <div className="text-muted-foreground mt-1 flex gap-2 text-xs">
                  <span>{item.calories} kcal</span>
                  <span>P:{item.protein}</span>
                  <span>F:{item.fat}</span>
                  <span>C:{item.carbs}</span>
                </div>
                <div className="text-muted-foreground mt-1 text-[10px]">
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              {/* Delete functionality could be added here */}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
