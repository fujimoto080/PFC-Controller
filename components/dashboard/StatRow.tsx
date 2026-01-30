'use client';

import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';

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
    const adjustedTarget = Math.max(0, target - debt);
    const pct = Math.min(100, (current / target) * 100);

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
                            (調整: -{debt})
                        </span>
                    )}
                </span>
            </div>
            <Progress value={pct} indicatorClassName={color} className="h-2" />
            {Array.from({ length: Math.min(10, Math.ceil(Math.max(0, current - target) / target)) }).map((_, i) => {
                const excess = current - target;
                const excessInThisBar = Math.min(target, Math.max(0, excess - i * target));
                const barPct = (excessInThisBar / target) * 100;
                
                return (
                    <Progress
                        key={i}
                        value={barPct}
                        indicatorClassName={color}
                        className="mt-1 h-2 border border-red-500"
                    />
                );
            })}
        </motion.div>
    );
}
