'use client';

import { motion } from 'framer-motion';
import { DebtStackedBars } from './DebtStackedBars';
import { roundPFC } from '@/lib/utils';

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
    const remaining = Math.max(0, adjustedTarget - current);

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
                    {roundPFC(current)} / {target}g
                    {debt > 0 && (
                        <span className="text-red-500 text-[10px] ml-1">
                            (負債: {debt}g)
                        </span>
                    )}
                </span>
            </div>
            <p className="text-muted-foreground text-xs">
                今日はあと <span className="font-semibold">{roundPFC(remaining)}g</span> 摂取できます
            </p>
            
            <DebtStackedBars
                current={current}
                debt={debt}
                target={target}
                color={color}
                delay={delay}
            />
        </motion.div>
    );
}
