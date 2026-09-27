'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useAppState } from '@/lib/client/store';
import { MACROS, type PfcKey } from '@/lib/macros';
import {
  CHEAT_DAY_FREE_OVER_DAYS,
  CHEAT_DAY_STREAK,
  computeDailyLimit,
} from '@/lib/pfc';
import { EMPTY_PFC } from '@/lib/types';
import { cn, roundPFC } from '@/lib/utils';

/**
 * 選択日の摂取量と上限の比較。運動した日は消費分だけ上限が増え、前日までの超過（負債）は上限から差し引く。
 * チートデーは超過しても負債にならないため、免除される範囲の超過は赤で示さない。
 */
export function DaySummary({ date }: { date: string }) {
  const { logs, settings } = useAppState();
  const total = logs[date]?.total ?? EMPTY_PFC;
  const {
    limit,
    target,
    debt,
    burnedCalories,
    isCheatDay,
    cheatDayCap,
    streak,
    overDays,
  } = useMemo(
    () => computeDailyLimit(date, settings.targetPFC, logs),
    [date, settings.targetPFC, logs],
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
          {debt.calories > 0 && (
            <span className="text-destructive block">
              前日までの超過 −{roundPFC(debt.calories, 0)}
            </span>
          )}
        </Link>
      </div>

      <LimitBar
        current={total.calories}
        target={target.calories}
        debt={debt.calories}
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
                debt={debt[key]}
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
  /** 前日までの超過分。バーの右端から上限を削る。 */
  debt: number;
  barClass: string;
  /** 上限をこの量まで超えても赤くしない（チートデー） */
  allowance?: number;
  thin?: boolean;
}

/** 目標値を全幅とした摂取量バー。負債で削られた部分は斜線で示し、上限を allowance より多く超えると赤くなる。 */
function LimitBar({
  current,
  target,
  debt,
  barClass,
  allowance = 0,
  thin,
}: LimitBarProps) {
  const scale = Math.max(1, target);
  const pct = (value: number) => Math.min(100, (value / scale) * 100);
  const isOver = current > target - debt + allowance;

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
