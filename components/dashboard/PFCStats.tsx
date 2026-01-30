'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { usePfcData } from '@/hooks/use-pfc-data';
import { getPFCPercentage, roundPFC } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { StatRow } from './StatRow';

interface PFCStatsProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function PFCStats({ selectedDate, onDateChange }: PFCStatsProps) {
  const { log: data, settings, debt } = usePfcData(selectedDate);
  const [direction, setDirection] = useState(0);

  if (!data)
    return (
      <div className="text-muted-foreground animate-pulse p-4 text-center">
        データを読み込み中...
      </div>
    );

  const { protein, fat, carbs, calories } = data.total;
  const { targetPFC } = settings;

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
        <Button
          onClick={(e) => {
            e.stopPropagation();
            navigateDate(-1);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          variant="ghost"
          size="icon"
          className="rounded-full bg-background/50 backdrop-blur-sm pointer-events-auto shadow-sm active:scale-95 hover:bg-secondary/80"
          aria-label="Previous day"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            navigateDate(1);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          variant="ghost"
          size="icon"
          className="rounded-full bg-background/50 backdrop-blur-sm pointer-events-auto shadow-sm active:scale-95 hover:bg-secondary/80"
          aria-label="Next day"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
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
          onDragEnd={(e, { offset, }) => {
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
              <div className="flex justify-between items-center px-2">
                {/* Spacers for the arrows that are positioned absolutely */}
                <div className="w-12" />
                <CardTitle className="text-muted-foreground text-lg font-medium text-center">
                  摂取カロリー
                </CardTitle>
                <div className="w-12" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className={`text-4xl font-bold tracking-tighter ${calories > targetPFC.calories ? 'text-red-500' : ''}`}>
                  {roundPFC(calories)}
                </span>
                <span className="text-muted-foreground text-sm">
                  / {targetPFC.calories} kcal
                  {debt.calories > 0 && (
                    <span className="text-red-500 font-bold ml-1">
                      (調整: -{debt.calories})
                    </span>
                  )}
                </span>
              </div>
              <Progress
                value={getPFCPercentage(calories, targetPFC.calories)}
                className="mt-2 h-2"
              />
              {Math.max(0, calories - targetPFC.calories) > 0 && (
                <Progress
                  value={getPFCPercentage(Math.max(0, calories - targetPFC.calories), targetPFC.calories)}
                  className="mt-1 h-2 border border-red-500"
                />
              )}
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardContent className="space-y-6 pt-6">
                <StatRow
                  label="タンパク質"
                  current={protein}
                  target={targetPFC.protein}
                  debt={debt.protein}
                  color="bg-blue-500"
                  delay={0.1}
                />
                <StatRow
                  label="脂質"
                  current={fat}
                  target={targetPFC.fat}
                  debt={debt.fat}
                  color="bg-yellow-500"
                  delay={0.2}
                />
                <StatRow
                  label="炭水化物"
                  current={carbs}
                  target={targetPFC.carbs}
                  debt={debt.carbs}
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


