'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toggleCarryoverExcludedDate } from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';
import { MACROS, type PfcKey } from '@/lib/macros';
import {
  CARRYOVER_DAYS,
  CHEAT_DAY_FREE_OVER_DAYS,
  CHEAT_DAY_STREAK,
  computeDailyLimit,
} from '@/lib/pfc';
import { EMPTY_PFC } from '@/lib/types';
import { cn, roundPFC } from '@/lib/utils';

/**
 * 選択日の摂取量と上限の比較。運動した日は消費分だけ上限が増え、前日までの超過（負債）は上限から差し引き、不足は上限に足す。
 * チートデーは超過しても負債にならないため、免除される範囲の超過は赤で示さない。
 */
export function DaySummary({ date }: { date: string }) {
  const { logs, settings } = useAppState();
  const total = logs[date]?.total ?? EMPTY_PFC;
  const {
    limit,
    target,
    carryover,
    burnedCalories,
    isCheatDay,
    cheatDayCap,
    streak,
    overDays,
  } = useMemo(
    () => computeDailyLimit(date, settings, logs),
    [date, settings, logs],
  );

  // 負債にならずに超えてよい量（チートデーでなければ 0、上限が無ければ無制限）
  const allowance = (key: PfcKey) =>
    isCheatDay ? (cheatDayCap?.[key] ?? Infinity) : 0;
  const calorieLeft = limit.calories - total.calories;
  const isOver = (key: PfcKey, left: number) => left < -allowance(key);

  return (
    <Card className="gap-5 px-5 py-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-xs">
            {calorieLeft >= 0 ? 'あと' : '上限を超過'}
            {isCheatDay && (
              <span className="bg-primary text-primary-foreground ml-2 rounded-full px-2 py-0.5 font-semibold">
                チートデー
              </span>
            )}
          </p>
          <p
            className={cn(
              'text-5xl font-bold tracking-tight tabular-nums',
              isOver('calories', calorieLeft) && 'text-destructive',
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
          上限 {roundPFC(limit.calories, 0).toLocaleString()} kcal
          {burnedCalories > 0 && (
            <span className="block">運動 +{roundPFC(burnedCalories, 0)}</span>
          )}
          {carryover.calories !== 0 && (
            <>
              <span
                className={cn(
                  'block',
                  carryover.calories > 0 && 'text-destructive',
                )}
              >
                {carryover.calories > 0
                  ? `超過の繰越 −${roundPFC(carryover.calories, 0)}`
                  : `不足の繰越 +${roundPFC(-carryover.calories, 0)}`}
              </span>
              <span className="block">
                各日の繰越は{CARRYOVER_DAYS}日で消えます
              </span>
            </>
          )}
        </Link>
      </div>

      <LimitBar
        current={total.calories}
        target={target.calories}
        limit={limit.calories}
        barClass="bg-primary"
        allowance={allowance('calories')}
      />

      <div className="grid grid-cols-3 gap-4">
        {MACROS.map(({ key, label, barClass }) => {
          const left = limit[key] - total[key];
          return (
            <div key={key} className="space-y-1.5">
              <p className="text-muted-foreground text-xs">{label}</p>
              <p
                className={cn(
                  'text-lg leading-none font-semibold tabular-nums',
                  isOver(key, left) && 'text-destructive',
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
                target={target[key]}
                limit={limit[key]}
                barClass={barClass}
                allowance={allowance(key)}
                thin
              />
              <p className="text-muted-foreground text-[10px] tabular-nums">
                {roundPFC(total[key], 1)} / {roundPFC(limit[key], 0)}g
              </p>
            </div>
          );
        })}
      </div>

      <CheatDayProgress
        isCheatDay={isCheatDay}
        cheatDayCalorieCap={cheatDayCap?.calories ?? null}
        streak={streak}
        overDays={overDays}
      />

      <Label className="text-muted-foreground text-xs font-normal">
        <Checkbox
          checked={settings.carryoverExcludedDates.includes(date)}
          onCheckedChange={() => {
            void toggleCarryoverExcludedDate(date);
          }}
        />
        この日の超過・不足を翌日以降に繰り越さない（入れ忘れた日など）
      </Label>
    </Card>
  );
}

/**
 * チートデーの案内。チートデーでなければ、あと何日記録すれば迎えられるかを示す。
 * 超過した日が多いとチートデーに上限が付くため、その旨も示す。
 */
function CheatDayProgress({
  isCheatDay,
  cheatDayCalorieCap,
  streak,
  overDays,
}: {
  isCheatDay: boolean;
  cheatDayCalorieCap: number | null;
  streak: number;
  overDays: number;
}) {
  if (isCheatDay) {
    return (
      <p className="text-muted-foreground text-xs">
        {CHEAT_DAY_STREAK}日続けて記録できたのでチートデー。
        {cheatDayCalorieCap === null
          ? '上限を超えても負債になりません'
          : `超過した日が${overDays}日あったため、負債にならないのは上限から+${roundPFC(cheatDayCalorieCap, 0)}kcalまで`}
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: CHEAT_DAY_STREAK }, (_, i) => (
          <span
            key={i}
            className={cn(
              'size-1.5 rounded-full',
              i < streak ? 'bg-primary' : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        あと{CHEAT_DAY_STREAK - streak}日記録するとチートデー
        {overDays > CHEAT_DAY_FREE_OVER_DAYS &&
          `（超過${overDays}日のため上限付き）`}
      </p>
    </div>
  );
}

interface LimitBarProps {
  current: number;
  target: number;
  /** 繰越を反映した上限。目標より小さければ右端を削り、大きければバーを延ばす。 */
  limit: number;
  barClass: string;
  /** 上限をこの量まで超えても赤くしない（チートデー） */
  allowance?: number;
  thin?: boolean;
}

/**
 * 目標値と上限の大きい方を全幅とした摂取量バー。超過の繰越で削られた部分は斜線、
 * 不足の繰越で増えた部分は薄い色で示し、上限を allowance より多く超えると赤くなる。
 */
function LimitBar({
  current,
  target,
  limit,
  barClass,
  allowance = 0,
  thin,
}: LimitBarProps) {
  const scale = Math.max(1, target, limit);
  const pct = (value: number) => Math.min(100, (value / scale) * 100);
  const isOver = current > limit + allowance;

  return (
    <div
      className={cn(
        'bg-muted relative w-full overflow-hidden rounded-full',
        thin ? 'h-1.5' : 'h-2.5',
      )}
    >
      {limit < target && (
        <div
          className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,var(--muted-foreground)_0_2px,transparent_2px_5px)] opacity-40"
          style={{ width: `${pct(target - limit)}%` }}
        />
      )}
      {limit > target && (
        <div
          className={cn('absolute inset-y-0 right-0 opacity-25', barClass)}
          style={{ width: `${pct(limit - target)}%` }}
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
