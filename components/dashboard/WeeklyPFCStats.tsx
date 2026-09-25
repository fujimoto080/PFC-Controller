'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CardHeader } from '@/components/ui/card';
import { GradientCard } from '@/components/ui/gradient-card';
import { Progress } from '@/components/ui/progress';
import { useAppState } from '@/lib/client/store';
import { overLimitTextClass, progressPct, weeklyAverage } from '@/lib/pfc';
import { MACROS } from '@/lib/macros';
import { cn, formatDate, roundPFC } from '@/lib/utils';

export function WeeklyPFCStats() {
  const { logs, settings } = useAppState();
  const average = useMemo(
    () => weeklyAverage(logs, formatDate(new Date())),
    [logs],
  );
  const { targetPFC } = settings;
  const { calories } = average;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">過去1週間の平均</h2>
        <span className="text-muted-foreground text-xs">
          過去7日間の平均摂取量
        </span>
      </div>

      <GradientCard className="from-card to-secondary/5">
        <CardHeader className="pb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-xs font-medium">
                平均カロリー
              </p>
              <div className="flex items-baseline space-x-1">
                <span
                  className={cn(
                    'text-2xl font-bold',
                    calories > targetPFC.calories && 'text-red-500',
                  )}
                >
                  {roundPFC(calories)}
                </span>
                <span className="text-muted-foreground text-xs">kcal</span>
              </div>
              <Progress
                value={progressPct(calories, targetPFC.calories)}
                className="mt-2 h-1.5"
              />
            </div>
            <div className="grid grid-cols-1 gap-2">
              {MACROS.map(({ key, short, barClass }) => (
                <WeeklyStatSmall
                  key={key}
                  label={short}
                  current={average[key]}
                  target={targetPFC[key]}
                  color={barClass}
                />
              ))}
            </div>
          </div>
        </CardHeader>
      </GradientCard>
    </motion.div>
  );
}

function WeeklyStatSmall({
  label,
  current,
  target,
  color,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="font-bold">{label}</span>
        <span className={overLimitTextClass(current, target)}>
          {roundPFC(current)}/{target}g
        </span>
      </div>
      <Progress
        value={progressPct(current, target)}
        indicatorClassName={color}
        className="h-1"
      />
    </div>
  );
}
