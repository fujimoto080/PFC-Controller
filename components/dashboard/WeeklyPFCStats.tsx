'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getWeeklyLog, getSettings } from '@/lib/storage';
import { UserSettings, DEFAULT_TARGET } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function WeeklyPFCStats() {
    const [weeklyData, setWeeklyData] = useState<{
        protein: number;
        fat: number;
        carbs: number;
        calories: number;
        daysCount: number;
    } | null>(null);
    const [settings, setSettings] = useState<UserSettings>({
        targetPFC: DEFAULT_TARGET,
    });

    useEffect(() => {
        setWeeklyData(getWeeklyLog());
        setSettings(getSettings());

        const handleUpdate = () => setWeeklyData(getWeeklyLog());
        window.addEventListener('pfc-update', handleUpdate);
        return () => window.removeEventListener('pfc-update', handleUpdate);
    }, []);

    if (!weeklyData) return null;

    const { protein, fat, carbs, calories } = weeklyData;
    const { targetPFC } = settings;

    const getPct = (current: number, target: number) =>
        Math.min(100, Math.max(0, (current / target) * 100));

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

            <Card className="from-card to-secondary/5 relative overflow-hidden border-none bg-gradient-to-br shadow-sm">
                <CardHeader className="pb-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-muted-foreground text-xs font-medium">
                                平均カロリー
                            </p>
                            <div className="flex items-baseline space-x-1">
                                <span className={`text-2xl font-bold ${calories > targetPFC.calories ? 'text-red-500' : ''}`}>{Math.round(calories * 100) / 100}</span>
                                <span className="text-muted-foreground text-xs">kcal</span>
                            </div>
                            <Progress
                                value={getPct(calories, targetPFC.calories)}
                                className="mt-2 h-1.5"
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            <WeeklyStatSmall
                                label="P"
                                current={protein}
                                target={targetPFC.protein}
                                color="bg-blue-500"
                            />
                            <WeeklyStatSmall
                                label="F"
                                current={fat}
                                target={targetPFC.fat}
                                color="bg-yellow-500"
                            />
                            <WeeklyStatSmall
                                label="C"
                                current={carbs}
                                target={targetPFC.carbs}
                                color="bg-green-500"
                            />
                        </div>
                    </div>
                </CardHeader>
            </Card>
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
    const pct = Math.min(100, (current / target) * 100);
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
                <span className="font-bold">{label}</span>
                <span className={`${current > target ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                    {Math.round(current * 100) / 100}/{target}g
                </span>
            </div>
            <Progress value={pct} indicatorClassName={color} className="h-1" />
        </div>
    );
}
