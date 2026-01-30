'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getBalancedWeeklyTargets, getSettings, getPfcDebt, getTodayString } from '@/lib/storage';
import { UserSettings, DEFAULT_TARGET, PFC } from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/card';

export function WeeklyBalancingStats() {
    const [balancedTarget, setBalancedTarget] = useState<{
        protein: number;
        fat: number;
        carbs: number;
        calories: number;
        remainingDays: number;
    } | null>(null);
    const [settings, setSettings] = useState<UserSettings>({
        targetPFC: DEFAULT_TARGET,
    });
    const [debt, setDebt] = useState<PFC>({ protein: 0, fat: 0, carbs: 0, calories: 0 });

    useEffect(() => {
        const today = getTodayString();
        queueMicrotask(() => {
            setBalancedTarget(getBalancedWeeklyTargets());
            setSettings(getSettings());
            setDebt(getPfcDebt(today));
        });

        const handleUpdate = () => {
            queueMicrotask(() => {
                setBalancedTarget(getBalancedWeeklyTargets());
                setDebt(getPfcDebt(today));
            });
        };
        window.addEventListener('pfc-update', handleUpdate);
        return () => window.removeEventListener('pfc-update', handleUpdate);
    }, []);

    if (!balancedTarget || balancedTarget.remainingDays === 0) return null;

    const { targetPFC } = settings;

    const isAdjusted =
        balancedTarget.protein < targetPFC.protein ||
        balancedTarget.fat < targetPFC.fat ||
        balancedTarget.carbs < targetPFC.carbs ||
        balancedTarget.calories < targetPFC.calories ||
        debt.calories > 0 || debt.protein > 0 || debt.fat > 0 || debt.carbs > 0;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="space-y-3"
        >
            <div className="flex items-center justify-between px-1">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    {isAdjusted ? "調整後の目標" : "今週の目標状況"}
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-normal transition-colors border-transparent bg-secondary text-secondary-foreground">
                        残り{balancedTarget.remainingDays}日
                    </span>
                </h2>
                <span className="text-muted-foreground text-[10px]">
                    {isAdjusted ? "食べ過ぎを調整するための目安" : "順調です！"}
                </span>
            </div>

            <Card className={`border-primary/20 ${isAdjusted ? "bg-primary/5" : "bg-green-500/5"}`}>
                <CardHeader className="p-4">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-xs font-medium">1日の推奨上限</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold tracking-tight text-primary">
                                    {Math.round(balancedTarget.calories * 100) / 100}
                                </span>
                                <span className="text-muted-foreground text-xs italic">
                                    kcal
                                </span>
                            </div>
                            {!isAdjusted && (
                                <p className="text-[10px] text-green-600 font-medium">
                                    目標通りでOKです
                                </p>
                            )}
                        </div>

                        <div className="space-y-3">
                            <MiniGoal
                                label="P"
                                current={balancedTarget.protein}
                                base={targetPFC.protein}
                                debt={debt.protein}
                                color="bg-blue-500"
                            />
                            <MiniGoal
                                label="F"
                                current={balancedTarget.fat}
                                base={targetPFC.fat}
                                debt={debt.fat}
                                color="bg-yellow-500"
                            />
                            <MiniGoal
                                label="C"
                                current={balancedTarget.carbs}
                                base={targetPFC.carbs}
                                debt={debt.carbs}
                                color="bg-green-500"
                            />
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <p className="text-muted-foreground text-[10px] text-center px-4">
                {isAdjusted
                    ? "※ 食べ過ぎた分（負債）を調整するために算出された目標です。"
                    : "※ 日曜日からの摂取量は目標内です。このままベース目標を維持しましょう。"}
            </p>
        </motion.div>
    );
}

function MiniGoal({
    label,
    current,
    base,
    debt,
    color
}: {
    label: string;
    current: number;
    base: number;
    debt: number;
    color: string;
}) {
    const diff = current - base;
    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold flex items-center gap-1">
                    {label}
                    <span className={debt > 0.005 ? "text-red-500" : diff < -0.005 ? "text-blue-500" : "text-muted-foreground"}>
                        {debt > 0.005 ? `${Math.round(debt * 100) / 100}` : Math.abs(diff) < 0.005 ? "±0" : Math.round(diff * 100) / 100}g
                    </span>
                </span>
                <span className="font-medium text-primary">{Math.round(current * 100) / 100}g</span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div
                    className={`h-full ${color}`}
                    style={{ width: `${Math.min(100, (current / (base * 1.5)) * 100)}%` }}
                />
            </div>
        </div>
    );
}
