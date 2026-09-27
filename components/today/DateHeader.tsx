'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { formatDate, shiftDate } from '@/lib/utils';

interface DateHeaderProps {
  date: string;
  onChange: (date: string) => void;
}

/** 表示日の切り替え。今日以外を見ているときは今日へ戻れる。 */
export function DateHeader({ date, onChange }: DateHeaderProps) {
  const [today] = useState(() => formatDate(Date.now()));
  const label = format(parseISO(date), 'M月d日(eee)', { locale: ja });

  return (
    <header className="flex items-center gap-1">
      <IconButton
        onClick={() => {
          onChange(shiftDate(date, -1));
        }}
        aria-label="前日"
      >
        <ChevronLeft />
      </IconButton>
      <div className="min-w-[7.5rem] text-center">
        <h1 className="text-xl leading-tight font-bold">
          {date === today ? '今日' : label}
        </h1>
        {date === today ? (
          <p className="text-muted-foreground text-xs">{label}</p>
        ) : (
          <button
            type="button"
            className="text-primary text-xs underline-offset-2 hover:underline"
            onClick={() => {
              onChange(today);
            }}
          >
            今日に戻る
          </button>
        )}
      </div>
      <IconButton
        onClick={() => {
          onChange(shiftDate(date, 1));
        }}
        aria-label="翌日"
      >
        <ChevronRight />
      </IconButton>
    </header>
  );
}
