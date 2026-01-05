'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getLogForDate, getSettings, getTodayString } from '@/lib/storage';
import { DailyLog, UserSettings, DEFAULT_TARGET } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';

interface PFCStatsProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function PFCStats({ selectedDate, onDateChange }: PFCStatsProps) {
  const [data, setData] = useState<DailyLog | null>(null);
  const [settings, setSettings] = useState<UserSettings>({
    targetPFC: DEFAULT_TARGET,
  });
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    // Load data for selected date
    setData(getLogForDate(selectedDate));
    setSettings(getSettings());

    const handleUpdate = () => setData(getLogForDate(selectedDate));
    window.addEventListener('pfc-update', handleUpdate);
    return () => window.removeEventListener('pfc-update', handleUpdate);
  }, [selectedDate]);

  if (!data)
    return (
      <div className="text-muted-foreground animate-pulse p-4 text-center">
        データを読み込み中...
      </div>
    );

  const { protein, fat, carbs, calories } = data.total;
  const { targetPFC } = settings;

  const getPct = (current: number, target: number) =>
    Math.min(100, Math.max(0, (current / target) * 100));

  const navigateDate = (days: number) => {
    const currentDate = parseISO(selectedDate);
    const newDate = addDays(currentDate, days);
    const dateStr = format(newDate, 'yyyy-MM-dd');
    setDirection(days);
    onDateChange(dateStr);
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div className="relative overflow-hidden group">
      {/* Navigation Arrows - Stable and outside the animated content */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center px-2 pointer-events-none h-16">
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigateDate(-1);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-3 hover:bg-secondary/80 bg-background/50 backdrop-blur-sm rounded-full transition-all pointer-events-auto shadow-sm active:scale-95"
          aria-label="Previous day"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigateDate(1);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-3 hover:bg-secondary/80 bg-background/50 backdrop-blur-sm rounded-full transition-all pointer-events-auto shadow-sm active:scale-95"
          aria-label="Next day"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={selectedDate}
          custom={direction}
          variants={variants}
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
          onDragEnd={(e, { offset, velocity }) => {
            const swipe = offset.x;
            if (swipe < -50) {
              navigateDate(1);
            } else if (swipe > 50) {
              navigateDate(-1);
            }
          }}
          className="space-y-4 touch-pan-y"
        >
          <Card className="from-card to-secondary/10 relative overflow-hidden border-none bg-gradient-to-br shadow-md">
            <div className="bg-primary/5 absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 rounded-full blur-3xl" />

            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-muted-foreground text-lg font-medium">
                  摂取カロリー
                </CardTitle>
                {/* Spacer for the arrows that are positioned absolutely */}
                <div className="w-20" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-bold tracking-tighter">
                  {Math.round(calories * 100) / 100}
                </span>
                <span className="text-muted-foreground text-sm">
                  / {targetPFC.calories} kcal
                </span>
              </div>
              <Progress
                value={getPct(calories, targetPFC.calories)}
                className="mt-2 h-2"
              />
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardContent className="space-y-6 pt-6">
                <StatRow
                  label="タンパク質"
                  current={protein}
                  target={targetPFC.protein}
                  color="bg-blue-500"
                  delay={0.1}
                />
                <StatRow
                  label="脂質"
                  current={fat}
                  target={targetPFC.fat}
                  color="bg-yellow-500"
                  delay={0.2}
                />
                <StatRow
                  label="炭水化物"
                  current={carbs}
                  target={targetPFC.carbs}
                  color="bg-green-500"
                  delay={0.3}
                />
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StatRow({
  label,
  current,
  target,
  color,
  delay,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
  delay: number;
}) {
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
        <span className="text-muted-foreground">
          {Math.round(current * 100) / 100} / {target}g
        </span>
      </div>
      <Progress value={pct} indicatorClassName={color} className="h-2" />
    </motion.div>
  );
}
