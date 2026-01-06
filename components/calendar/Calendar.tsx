'use client';

import { useState, useEffect } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getLogs, getSettings } from '@/lib/storage';
import { DailyLog, UserSettings } from '@/lib/types';
import { cn } from '@/lib/utils';

export function Calendar() {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [logs, setLogs] = useState<Record<string, DailyLog>>({});
    const [settings, setSettings] = useState<UserSettings | null>(null);

    useEffect(() => {
        setLogs(getLogs());
        setSettings(getSettings());

        const handleUpdate = () => {
            setLogs(getLogs());
            setSettings(getSettings());
        };

        window.addEventListener('pfc-update', handleUpdate);
        return () => window.removeEventListener('pfc-update', handleUpdate);
    }, []);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    // Split days into weeks
    const weeks: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
        weeks.push(calendarDays.slice(i, i + 7));
    }

    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

    if (!settings) return null;

    const targetCalories = settings.targetPFC.calories;
    const weeklyTarget = targetCalories * 7;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-bold">
                    {format(currentMonth, 'yyyy年 M月', { locale: ja })}
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="rounded-full p-2 transition-colors hover:bg-accent"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="rounded-full p-2 transition-colors hover:bg-accent"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>

            <div className="bg-card rounded-3xl border p-4 shadow-sm">
                <div className="mb-2 grid grid-cols-[repeat(7,1fr)_40px] gap-1">
                    {weekDays.map((day, i) => (
                        <div
                            key={day}
                            className={cn(
                                "text-center text-xs font-medium text-muted-foreground",
                                i === 0 && "text-red-400",
                                i === 6 && "text-blue-400"
                            )}
                        >
                            {day}
                        </div>
                    ))}
                    <div className="text-center text-[10px] font-bold text-muted-foreground self-center">
                        週
                    </div>
                </div>

                <div className="space-y-1">
                    {weeks.map((week, weekIdx) => {
                        const weekCalories = week.reduce((acc, day) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            return acc + (logs[dateStr]?.total?.calories || 0);
                        }, 0);
                        const isWeekOver = weekCalories > weeklyTarget;

                        return (
                            <div key={weekIdx} className="grid grid-cols-[repeat(7,1fr)_40px] gap-1">
                                {week.map((day) => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const log = logs[dateStr];
                                    const calories = log?.total?.calories || 0;
                                    const isToday = isSameDay(day, new Date());
                                    const isCurrentMonth = isSameMonth(day, monthStart);
                                    const isOver = calories > targetCalories;

                                    return (
                                        <div
                                            key={dateStr}
                                            className={cn(
                                                "relative flex min-h-[60px] flex-col items-center justify-start rounded-xl p-1 transition-colors",
                                                !isCurrentMonth && "opacity-20",
                                                isToday && "bg-primary/5 ring-1 ring-primary/20"
                                            )}
                                        >
                                            <span className={cn(
                                                "text-[10px] font-medium",
                                                isToday && "text-primary font-bold"
                                            )}>
                                                {format(day, 'd')}
                                            </span>
                                            {calories > 0 && (
                                                <div className="mt-auto w-full text-center">
                                                    <span className={cn(
                                                        "block text-[8px] font-bold leading-tight sm:text-[10px]",
                                                        isOver ? "text-red-500" : "text-muted-foreground"
                                                    )}>
                                                        {Math.round(calories)}
                                                    </span>
                                                    <div className="mx-auto mt-0.5 h-1 w-full max-w-[20px] rounded-full bg-muted-foreground/10 overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                "h-full rounded-full transition-all duration-500",
                                                                isOver ? "bg-red-500" : "bg-primary"
                                                            )}
                                                            style={{ width: `${Math.min(100, (calories / targetCalories) * 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {/* Weekly progress bar */}
                                <div className="flex flex-col items-center justify-center border-l pl-1">
                                    <div className="relative h-12 w-1.5 rounded-full bg-muted-foreground/10 overflow-hidden">
                                        <div
                                            className={cn(
                                                "absolute bottom-0 w-full rounded-full transition-all duration-500",
                                                isWeekOver ? "bg-red-500" : "bg-green-500"
                                            )}
                                            style={{ height: `${Math.min(100, (weekCalories / weeklyTarget) * 100)}%` }}
                                        />
                                    </div>
                                    <span className={cn(
                                        "mt-1 text-[7px] font-bold",
                                        isWeekOver ? "text-red-500" : "text-muted-foreground"
                                    )}>
                                        {Math.round(weekCalories)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-card glassmorphism rounded-2xl border p-4 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">今月のサマリー</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground">総摂取カロリー</p>
                        <p className="text-lg font-bold">
                            {Math.round(
                                Object.values(logs)
                                    .filter(log => log.date.startsWith(format(currentMonth, 'yyyy-MM')))
                                    .reduce((acc, log) => acc + (log.total?.calories || 0), 0)
                            ).toLocaleString()} kcal
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">平均 / 日</p>
                        <p className="text-lg font-bold">
                            {Math.round(
                                Object.values(logs)
                                    .filter(log => log.date.startsWith(format(currentMonth, 'yyyy-MM')))
                                    .reduce((acc, log) => acc + (log.total?.calories || 0), 0) /
                                Math.max(1, Object.values(logs).filter(log => log.date.startsWith(format(currentMonth, 'yyyy-MM')) && log.total?.calories > 0).length)
                            ).toLocaleString()} kcal
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
