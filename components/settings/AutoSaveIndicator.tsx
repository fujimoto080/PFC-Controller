'use client';

import { Check, CircleAlert, Loader2 } from 'lucide-react';
import { CardAction } from '@/components/ui/card';
import type { AutoSaveStatus } from '@/hooks/use-auto-save';
import { cn } from '@/lib/utils';

const CONTENT = {
  saving: { icon: Loader2, label: '保存中…', iconClass: 'animate-spin' },
  saved: { icon: Check, label: '保存済み', iconClass: 'text-green-600' },
  error: { icon: CircleAlert, label: '保存できませんでした', iconClass: '' },
  invalid: {
    icon: CircleAlert,
    label: '入力を確認してください',
    iconClass: '',
  },
} as const;

/** 設定カードの右上に自動保存の状態を小さく出す。 */
export function AutoSaveIndicator({ status }: { status: AutoSaveStatus }) {
  if (status === 'idle') return null;
  const { icon: Icon, label, iconClass } = CONTENT[status];
  return (
    <CardAction>
      <output
        className={cn(
          'flex items-center gap-1 text-xs',
          status === 'error' || status === 'invalid'
            ? 'text-destructive'
            : 'text-muted-foreground',
        )}
      >
        <Icon className={cn('size-3.5', iconClass)} />
        {label}
      </output>
    </CardAction>
  );
}
