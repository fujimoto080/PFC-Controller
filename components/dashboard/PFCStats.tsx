'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GradientCard } from '@/components/ui/gradient-card';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppState } from '@/lib/client/store';
import { activityAdjustedCalorieTarget, computePfcDebt } from '@/lib/pfc';
import { createEmptyDailyLog } from '@/lib/types';
import { MACROS } from '@/lib/macros';
import { cn, roundPFC, shiftDate } from '@/lib/utils';
import { IconButton } from '@/components/ui/icon-button';
import { StatRow } from './StatRow';
import { DebtStackedBars } from './DebtStackedBars';
import { SportActivityControls } from './SportActivityControls';

const DATE_NAV = [
  { days: -1, Icon: ChevronLeft, label: '前日' },
  { days: 1, Icon: ChevronRight, label: '翌日' },
] as const;

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { zIndex: 1, x: 0, opacity: 1 },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

interface PFCStatsProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function PFCStats({ selectedDate, onDateChange }: PFCStatsProps) {
  const { logs, settings, sports } = useAppState();
  const [direction, setDirection] = useState(0);
  const { targetPFC } = settings;
  const data = logs[selectedDate] ?? createEmptyDailyLog(selectedDate);
  const debt = useMemo(
    () => computePfcDebt(selectedDate, targetPFC, logs),
    [selectedDate, targetPFC, logs],
  );

  const { calories } = data.total;
  const boostedCalorieTarget = activityAdjustedCalorieTarget(
    targetPFC.calories,
    data,
  );
  const adjustedCalorieTarget = Math.max(
    0,
    boostedCalorieTarget - debt.calories,
  );
  const remainingCalories = Math.max(0, adjustedCalorieTarget - calories);
  const activityBonusCalories = Math.max(
    0,
    boostedCalorieTarget - targetPFC.calories,
  );

  const navigateDate = (days: number) => {
    setDirection(days);
    onDateChange(shiftDate(selectedDate, days));
  };

  return (
    <div className="group relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 right-0 left-0 z-20 flex h-16 items-center justify-between px-2">
        {DATE_NAV.map(({ days, Icon, label }) => (
          <IconButton
            key={days}
            onClick={(e) => {
              e.stopPropagation();
              navigateDate(days);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            className="bg-background/50 hover:bg-secondary/80 pointer-events-auto rounded-full shadow-sm backdrop-blur-sm active:scale-95"
            aria-label={label}
          >
            <Icon className="h-6 w-6" />
          </IconButton>
        ))}
      </div>

      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={selectedDate}
          custom={direction}
          variants={SLIDE_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDragEnd={(_e, { offset }) => {
            const swipe = offset.x;
            if (swipe < -50) {
              navigateDate(1);
            } else if (swipe > 50) {
              navigateDate(-1);
            }
          }}
          className="touch-pan-y space-y-4"
        >
          <GradientCard>
            <div className="bg-primary/5 absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 rounded-full blur-3xl" />

            <CardHeader className="pb-2">
              <div className="flex items-center justify-between px-2">
                {/* 絶対配置した日付切り替え矢印の分の余白 */}
                <div className="w-12" />
                <CardTitle className="text-muted-foreground text-center text-lg font-medium">
                  摂取カロリー
                </CardTitle>
                <div className="w-12" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span
                  className={cn(
                    'text-4xl font-bold tracking-tighter',
                    calories > adjustedCalorieTarget && 'text-red-500',
                  )}
                >
                  {roundPFC(calories)}
                </span>
                <span className="text-muted-foreground text-sm">
                  / {roundPFC(adjustedCalorieTarget)} kcal
                  {debt.calories > 0 && (
                    <span className="ml-1 text-[10px] text-red-500">
                      (負債: {debt.calories} kcal)
                    </span>
                  )}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                今日はあと{' '}
                <span className="font-semibold">
                  {roundPFC(remainingCalories)} kcal
                </span>{' '}
                摂取できます
                {activityBonusCalories > 0 && (
                  <span className="ml-1 text-emerald-600">
                    (運動で +{roundPFC(activityBonusCalories)} kcal)
                  </span>
                )}
              </p>
              <div className="mt-2">
                <DebtStackedBars
                  current={calories}
                  debt={debt.calories}
                  target={targetPFC.calories}
                  color="bg-primary"
                />
              </div>
            </CardHeader>
          </GradientCard>

          <SportActivityControls
            date={selectedDate}
            sports={sports}
            activities={data.activities}
          />

          <Card>
            <CardContent className="space-y-6 pt-6">
              {MACROS.map(({ key, label, barClass }, i) => (
                <StatRow
                  key={key}
                  label={label}
                  current={data.total[key]}
                  target={targetPFC[key]}
                  debt={debt[key]}
                  color={barClass}
                  delay={0.1 * (i + 1)}
                />
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
