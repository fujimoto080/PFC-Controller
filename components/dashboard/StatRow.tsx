'use client';

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

export function StatRow({
    label,
    current,
    target,
    debt,
    color,
    delay,
}: StatRowProps) {
    const adjustedTarget = target - debt;
    const totalValue = current + debt;

    const renderBar = (d: number, c: number, t: number, isFirst: boolean) => {
        const cPct = Math.min(100, (c / t) * 100);
        const dPct = Math.min(100 - cPct, (d / t) * 100);
        
        return (
            <div className={cn("relative w-full overflow-hidden rounded-full bg-primary/20", isFirst ? "h-2" : "h-2 mt-1 border border-red-500/30")}>
                {/* Current Intake Bar (Normal) */}
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${cPct}%` }}
                    transition={{ delay: delay + 0.2, duration: 0.5 }}
                    className={cn("absolute left-0 top-0 h-full rounded-full", color)}
                />
                {/* Debt Bar (Thin) */}
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

    const extraBarsCount = Math.ceil(Math.max(0, totalValue - target) / target);

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
                            (負債: -{debt})
                        </span>
                    )}
                </span>
            </div>
            
            {/* Primary Bar */}
            {renderBar(debt, current, target, true)}

            {/* Extra Bars for excess */}
            {Array.from({ length: Math.min(10, extraBarsCount) }).map((_, i) => {
                const barTargetStart = (i + 1) * target;
                // Debt in this bar
                const debtInThisBar = Math.min(target, Math.max(0, debt - barTargetStart));
                // Current in this bar (considering debt already occupied some space)
                const currentInThisBar = Math.min(target - debtInThisBar, Math.max(0, (current + debt) - barTargetStart - debtInThisBar));

                if (debtInThisBar + currentInThisBar <= 0) return null;

                return (
                    <div key={i}>
                        {renderBar(debtInThisBar, currentInThisBar, target, false)}
                    </div>
                );
            })}
        </motion.div>
    );
}
