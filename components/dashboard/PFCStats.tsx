'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getTodayLog, getSettings } from '@/lib/storage';
import { DailyLog, UserSettings, DEFAULT_TARGET } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function PFCStats() {
  const [data, setData] = useState<DailyLog | null>(null);
  const [settings, setSettings] = useState<UserSettings>({
    targetPFC: DEFAULT_TARGET,
  });

  useEffect(() => {
    // Initial load
    setData(getTodayLog());
    setSettings(getSettings());

    const handleUpdate = () => setData(getTodayLog());
    window.addEventListener('pfc-update', handleUpdate);
    return () => window.removeEventListener('pfc-update', handleUpdate);
  }, []);

  if (!data)
    return (
      <div className="text-muted-foreground animate-pulse p-4 text-center">
        データを読み込み中...
      </div>
    );

  const { protein, fat, carbs, calories } = data.total;
  const { targetPFC } = settings;

  // Helper to calculate percentage
  const getPct = (current: number, target: number) =>
    Math.min(100, Math.max(0, (current / target) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      <Card className="from-card to-secondary/10 relative overflow-hidden border-none bg-gradient-to-br shadow-md">
        <div className="bg-primary/5 absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 rounded-full blur-3xl" />

        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground text-lg font-medium">
            摂取カロリー
          </CardTitle>
          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-bold tracking-tighter">
              {calories}
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
          {current} / {target}g
        </span>
      </div>
      <Progress value={pct} indicatorClassName={color} className="h-2" />
    </motion.div>
  );
}
