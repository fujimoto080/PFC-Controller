'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useAppState } from '@/lib/client/store';
import { MACROS } from '@/lib/macros';
import { computeDailyLimit } from '@/lib/pfc';
import { EMPTY_PFC } from '@/lib/types';
import { cn, roundPFC } from '@/lib/utils';

/** 直近の超過を分散した日次目標と、週平均を表示する。 */
export function DaySummary({ date }: { date: string }) {
  const { logs, settings } = useAppState();
  const total = logs[date]?.total ?? EMPTY_PFC;
  const {
    limit: target,
    target: baseTarget,
    adjustment,
    calorieRange,
    fatRange,
    weekly,
  } = computeDailyLimit(date, settings, logs);
  const left = target.calories - total.calories;
  const inRange =
    total.calories >= calorieRange.min && total.calories <= calorieRange.max;
  return (
    <Card className="px-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-xs">
            {inRange
              ? '今日の目標範囲内'
              : left >= 0
                ? '目標まであと'
                : '目標より多め'}
          </p>
          <p
            className={cn(
              'text-5xl font-bold tracking-tight tabular-nums',
              total.calories > calorieRange.max && 'text-destructive',
            )}
          >
            {inRange
              ? roundPFC(total.calories, 0).toLocaleString()
              : roundPFC(Math.abs(left), 0).toLocaleString()}
            <span className="text-muted-foreground ml-1 text-base font-medium">
              kcal
            </span>
          </p>
        </div>
        <Link
          href="/settings"
          className="text-muted-foreground text-right text-xs underline-offset-2 hover:underline"
        >
          <span className="block">1日の目標</span>
          <span className="text-foreground block text-3xl font-bold tabular-nums">
            {target.calories.toLocaleString()}
            <span className="ml-1 text-sm font-medium">kcal</span>
          </span>
          <span className="block">
            目安 {calorieRange.min}〜{calorieRange.max} kcal
          </span>
          {adjustment.calories < 0 && (
            <span className="block">
              基本 {baseTarget.calories} · 週の調整 {adjustment.calories} kcal
            </span>
          )}
        </Link>
      </div>
      <ProgressBar
        current={total.calories}
        target={target.calories}
        barClass="bg-primary"
        over={total.calories > calorieRange.max}
      />
      <div className="grid grid-cols-3 gap-4">
        {MACROS.map(({ key, label, barClass }) => {
          return (
            <div key={key} className="space-y-1.5">
              <p className="text-muted-foreground text-xs">{label}</p>
              <p className="text-lg leading-none font-semibold whitespace-nowrap tabular-nums">
                {roundPFC(total[key], 1)}g
              </p>
              <ProgressBar
                current={total[key]}
                target={target[key]}
                barClass={barClass}
              />
              <p className="text-muted-foreground text-[10px] tabular-nums">
                {key === 'protein'
                  ? `目標 ${target.protein}g`
                  : key === 'fat'
                    ? `目安 ${fatRange.min}〜${fatRange.max}g`
                    : `目安 ${target.carbs}g`}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        残りカロリー内でたんぱく質を優先。脂質・炭水化物を埋めるために追加で食べる必要はありません。
      </p>
      <p className="text-muted-foreground text-xs">
        減額は1日5%・最大100kcalまで。P・Fは維持し、Cで調整します。下限に達した分は無理に取り戻しません。食事は漏れなく記録してください。
      </p>
      <div className="text-muted-foreground space-y-1 text-xs">
        <p>前日まで7日間の記録平均（{weekly.recordedDays}/7日）</p>
        {weekly.average ? (
          <p>
            1日平均 {roundPFC(weekly.average.calories, 0)} kcal · P{' '}
            {roundPFC(weekly.average.protein, 1)}g · F{' '}
            {roundPFC(weekly.average.fat, 1)}g · C{' '}
            {roundPFC(weekly.average.carbs, 1)}g
          </p>
        ) : (
          <p>記録がまだありません。</p>
        )}
        <p>
          未記録日と今日は平均に含みません。記録漏れがある日は平均が低く出ます。超過は7日間に分散して目標を少し調整します。
        </p>
      </div>
    </Card>
  );
}

function ProgressBar({
  current,
  target,
  barClass,
  over = false,
}: {
  current: number;
  target: number;
  barClass: string;
  over?: boolean;
}) {
  return (
    <div className="bg-muted h-2 overflow-hidden rounded-full">
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          over ? 'bg-destructive' : barClass,
        )}
        style={{
          width: `${Math.min(100, Math.max(0, (current / Math.max(1, target)) * 100))}%`,
        }}
      />
    </div>
  );
}
