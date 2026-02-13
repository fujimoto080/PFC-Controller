'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatRowProps {
    label: string;
    current: number;
    target: number;
    debt: number;
    color: string;
    delay: number;
}

export const StatRow = memo(function StatRow({
    label,
    current,
    target,
    debt,
    color,
    delay,
}: StatRowProps) {
    const adjustedTarget = target - debt;
    const remaining = Math.max(0, adjustedTarget - current);

    const renderBar = (d: number, c: number, t: number, isFirst: boolean) => {
        // Calculate percentage for content within this specific bar's target (t)
        // c: current intake allocated to this bar
        // d: debt allocated to this bar
        const total = c + d;
        const totalPct = Math.min(100, (total / t) * 100);
        const dPct = Math.min(totalPct, (d / t) * 100);
        const cPct = Math.max(0, totalPct - dPct);
        
        return (
            <div className={cn("relative w-full overflow-hidden rounded-full bg-primary/20", isFirst ? "h-2" : "h-2 mt-1 border border-red-500/30")}>
                {/* Current Intake Bar */}
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${cPct}%` }}
                    transition={{ delay: delay + 0.2, duration: 0.5 }}
                    className={cn("absolute left-0 top-0 h-full rounded-full", color)}
                />
                {/* Debt Bar */}
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${dPct}%` }}
                    style={{ left: `${cPct}%` }}
                    transition={{ delay, duration: 0.5 }}
                    className={cn("absolute top-1/2 -translate-y-1/2 h-[40%] rounded-full opacity-50", color)}
                />
            </div>
        );
    };

    const extraBarsCount = Math.ceil(Math.max(0, (current + debt) - target) / target);

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay, duration: 0.4 }}
            className="space-y-2"
        >
            <div className="flex justify-between text-sm">
                <span className="font-medium">{label}</span>
                <span className={`${current > adjustedTarget ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                    {Math.round(current * 100) / 100} / {target}g
                    {debt > 0 && (
                        <span className="text-red-500 text-[10px] ml-1">
                            (負債: {debt}g)
                        </span>
                    )}
                </span>
            </div>
            <p className="text-muted-foreground text-xs">
                今日はあと <span className="font-semibold">{Math.round(remaining * 100) / 100}g</span> 摂取できます
            </p>
            
            {/* Primary Bar */}
            {/* Priority: current first, then debt */}
            {(() => {
                const currentInBar = Math.min(target, current);
                const debtInBar = Math.min(target - currentInBar, debt);
                return renderBar(debtInBar, currentInBar, target, true);
            })()}

            {/* Extra Bars for excess */}
            {Array.from({ length: Math.min(10, extraBarsCount) }).map((_, i) => {
                const barStart = (i + 1) * target;
                const barEnd = (i + 2) * target;
                
                // Current's portion in this specific extra bar range [barStart, barEnd]
                const currentInThisBar = Math.max(0, Math.min(target, current - barStart));
                
                // Debt's portion starts after ALL of 'current' is filled.
                // Debt exists in the range [current, current + debt]
                const debtStart = current;
                const debtEnd = current + debt;
                
                // Intersection of [barStart, barEnd] and [debtStart, debtEnd]
                const debtInThisBarActual = Math.max(0, Math.min(barEnd, debtEnd) - Math.max(barStart, debtStart));

                if (currentInThisBar + debtInThisBarActual <= 0) return null;

                return (
                    <div key={i}>
                        {renderBar(debtInThisBarActual, currentInThisBar, target, false)}
                    </div>
                );
            })}
        </motion.div>
    );
});
