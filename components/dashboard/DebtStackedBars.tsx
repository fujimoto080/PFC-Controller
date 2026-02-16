'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DebtStackedBarsProps {
  current: number;
  debt: number;
  target: number;
  color: string;
  delay?: number;
  maxBars?: number;
}

interface BarProps {
  currentInBar: number;
  debtInBar: number;
  target: number;
  color: string;
  delay: number;
  isFirst: boolean;
}

function SingleDebtBar({ currentInBar, debtInBar, target, color, delay, isFirst }: BarProps) {
  const total = currentInBar + debtInBar;
  const totalPct = Math.min(100, (total / target) * 100);
  const debtPct = Math.min(totalPct, (debtInBar / target) * 100);
  const currentPct = Math.max(0, totalPct - debtPct);

  return (
    <div className={cn('relative w-full overflow-hidden rounded-full bg-primary/20', isFirst ? 'h-2' : 'mt-1 h-2 border border-red-500/30')}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${currentPct}%` }}
        transition={{ delay: delay + 0.2, duration: 0.5 }}
        className={cn('absolute left-0 top-0 h-full rounded-full', color)}
      />
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${debtPct}%` }}
        style={{ left: `${currentPct}%` }}
        transition={{ delay, duration: 0.5 }}
        className={cn('absolute top-1/2 h-[40%] -translate-y-1/2 rounded-full opacity-50', color)}
      />
    </div>
  );
}

export function DebtStackedBars({ current, debt, target, color, delay = 0, maxBars = 10 }: DebtStackedBarsProps) {
  const extraBarsCount = Math.ceil(Math.max(0, current + debt - target) / target);
  const safeTarget = Math.max(1, target);

  return (
    <>
      <SingleDebtBar
        currentInBar={Math.min(safeTarget, current)}
        debtInBar={Math.min(safeTarget - Math.min(safeTarget, current), debt)}
        target={safeTarget}
        color={color}
        delay={delay}
        isFirst
      />

      {Array.from({ length: Math.min(maxBars, extraBarsCount) }).map((_, i) => {
        const barStart = (i + 1) * safeTarget;
        const barEnd = (i + 2) * safeTarget;
        const currentInThisBar = Math.max(0, Math.min(safeTarget, current - barStart));
        const debtStart = current;
        const debtEnd = current + debt;
        const debtInThisBar = Math.max(0, Math.min(barEnd, debtEnd) - Math.max(barStart, debtStart));

        if (currentInThisBar + debtInThisBar <= 0) {
          return null;
        }

        return (
          <SingleDebtBar
            key={i}
            currentInBar={currentInThisBar}
            debtInBar={debtInThisBar}
            target={safeTarget}
            color={color}
            delay={delay}
            isFirst={false}
          />
        );
      })}
    </>
  );
}
