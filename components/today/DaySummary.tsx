'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useAppState } from '@/lib/client/store';
import { MACROS } from '@/lib/macros';
import { computePfcDebt } from '@/lib/pfc';
import { EMPTY_PFC } from '@/lib/types';
import { cn, roundPFC } from '@/lib/utils';

/**
 * 選択日の摂取量と上限の比較。前日までの超過（負債）はその日の上限から差し引く。
 */
export function DaySummary({ date }: { date: string }) {
  const { logs, settings } = useAppState();
  const { targetPFC } = settings;
  const total = logs[date]?.total ?? EMPTY_PFC;
  const debt = useMemo(
    () => computePfcDebt(date, targetPFC, logs),
    [date, targetPFC, logs],
  );

  const calorieLimit = Math.max(0, targetPFC.calories - debt.calories);
  const calorieLeft = calorieLimit - total.calories;

  return (
    <Card className="gap-5 px-5 py-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-xs">
            {calorieLeft >= 0 ? 'あと' : '上限を超過'}
          </p>
          <p
            className={cn(
              'text-5xl font-bold tracking-tight tabular-nums',
              calorieLeft < 0 && 'text-destructive',
            )}
          >
            {roundPFC(Math.abs(calorieLeft), 0).toLocaleString()}
            <span className="text-muted-foreground ml-1 text-base font-medium">
              kcal
            </span>
          </p>
        </div>
        <Link
          href="/settings"
          className="text-muted-foreground text-right text-xs underline-offset-2 hover:underline"
        >
          上限 {roundPFC(calorieLimit, 0).toLocaleString()} kcal
          {debt.calories > 0 && (
            <span className="text-destructive block">
              前日までの超過 −{roundPFC(debt.calories, 0)}
            </span>
          )}
        </Link>
      </div>

      <LimitBar
        current={total.calories}
        target={targetPFC.calories}
        debt={debt.calories}
        barClass="bg-primary"
      />

      <div className="grid grid-cols-3 gap-4">
        {MACROS.map(({ key, label, barClass }) => {
          const limit = Math.max(0, targetPFC[key] - debt[key]);
          const left = limit - total[key];
          return (
            <div key={key} className="space-y-1.5">
              <p className="text-muted-foreground text-xs">{label}</p>
              <p
                className={cn(
                  'text-lg leading-none font-semibold tabular-nums',
                  left < 0 && 'text-destructive',
                )}
              >
                <span className="mr-1 text-[10px] font-normal">
                  {left < 0 ? '超過' : 'あと'}
                </span>
                {roundPFC(Math.abs(left), 0)}
                <span className="text-muted-foreground ml-0.5 text-xs font-normal">
                  g
                </span>
              </p>
              <LimitBar
                current={total[key]}
                target={targetPFC[key]}
                debt={debt[key]}
                barClass={barClass}
                thin
              />
              <p className="text-muted-foreground text-[10px] tabular-nums">
                {roundPFC(total[key], 1)} / {roundPFC(limit, 0)}g
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

interface LimitBarProps {
  current: number;
  target: number;
  /** 前日までの超過分。バーの右端から上限を削る。 */
  debt: number;
  barClass: string;
  thin?: boolean;
}

/** 目標値を全幅とした摂取量バー。負債で削られた部分は斜線で示し、上限超過で赤くなる。 */
function LimitBar({ current, target, debt, barClass, thin }: LimitBarProps) {
  const scale = Math.max(1, target);
  const pct = (value: number) => Math.min(100, (value / scale) * 100);
  const isOver = current > target - debt;

  return (
    <div
      className={cn(
        'bg-muted relative w-full overflow-hidden rounded-full',
        thin ? 'h-1.5' : 'h-2.5',
      )}
    >
      {debt > 0 && (
        <div
          className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,var(--muted-foreground)_0_2px,transparent_2px_5px)] opacity-40"
          style={{ width: `${pct(debt)}%` }}
        />
      )}
      <div
        className={cn(
          'absolute inset-y-0 left-0 rounded-full transition-[width] duration-500',
          isOver ? 'bg-destructive' : barClass,
        )}
        style={{ width: `${pct(current)}%` }}
      />
    </div>
  );
}
