'use client';

import { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLogs } from '@/lib/storage/logs';
import { usePfcData } from '@/hooks/use-pfc-data';

interface PfcDebtChartsProps {
  referenceDate: string;
  days?: number;
}

type NutrientKey = 'protein' | 'fat' | 'carbs' | 'calories';

interface DebtVisual {
  intake: number;
  debtWithinLimit: number;
  overflow: number;
  nextCarry: number;
}

const nutrientLabels: Record<NutrientKey, string> = {
  protein: 'タンパク質',
  fat: '脂質',
  carbs: '炭水化物',
  calories: 'カロリー',
};

const nutrientColors: Record<NutrientKey, string> = {
  protein: '#60a5fa',
  fat: '#fbbf24',
  carbs: '#4ade80',
  calories: '#a78bfa',
};

const overLimitColor = '#f87171';

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--muted-foreground)', fontSize: 11 },
  tickMargin: 8,
} as const;

const gridProps = {
  vertical: false,
  stroke: 'var(--border)',
  strokeDasharray: '2 6',
} as const;

const tooltipProps = {
  cursor: { fill: 'var(--muted-foreground)', fillOpacity: 0.06 },
  contentStyle: {
    background: 'var(--popover)',
    border: 'none',
    borderRadius: 10,
    boxShadow: '0 4px 16px oklch(0 0 0 / 0.12)',
    fontSize: 12,
    padding: '8px 10px',
  },
  labelStyle: { color: 'var(--muted-foreground)', fontSize: 11, marginBottom: 4 },
  itemStyle: { padding: 0 },
} as const;

const limitLineProps = {
  stroke: overLimitColor,
  strokeWidth: 1,
  strokeDasharray: '3 3',
} as const;

const limitLabel = {
  value: '上限',
  position: 'right',
  fill: overLimitColor,
  fontSize: 10,
} as const;

function calculateDebtVisual(intake: number, target: number, carry: number): DebtVisual {
  const safeTarget = Math.max(1, target);
  const intakeWithinLimit = Math.min(intake, safeTarget);
  const debtWithinLimit = Math.min(carry, Math.max(0, safeTarget - intakeWithinLimit));
  const overflow = Math.max(0, intake + carry - safeTarget);

  return {
    intake: intakeWithinLimit,
    debtWithinLimit,
    overflow,
    nextCarry: overflow,
  };
}

export function PfcDebtCharts({ referenceDate, days = 20 }: PfcDebtChartsProps) {
  const [isSplitView, setIsSplitView] = useState(false);
  const windowStartDate = useMemo(() => {
    const reference = parseISO(referenceDate);
    return format(addDays(reference, -(days - 1)), 'yyyy-MM-dd');
  }, [referenceDate, days]);
  const { settings, debt } = usePfcData(windowStartDate);

  const chartData = useMemo(() => {
    const logs = getLogs();
    const start = parseISO(windowStartDate);
    const data: Record<string, number | string>[] = [];

    let proteinCarry = debt.protein;
    let fatCarry = debt.fat;
    let carbsCarry = debt.carbs;
    let caloriesCarry = debt.calories;

    for (let i = 0; i < days; i++) {
      const date = addDays(start, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const label = format(date, 'M/d');
      const total = logs[dateStr]?.total;

      const proteinVisual = calculateDebtVisual(total?.protein ?? 0, settings.targetPFC.protein, proteinCarry);
      const fatVisual = calculateDebtVisual(total?.fat ?? 0, settings.targetPFC.fat, fatCarry);
      const carbsVisual = calculateDebtVisual(total?.carbs ?? 0, settings.targetPFC.carbs, carbsCarry);
      const caloriesVisual = calculateDebtVisual(total?.calories ?? 0, settings.targetPFC.calories, caloriesCarry);

      proteinCarry = proteinVisual.nextCarry;
      fatCarry = fatVisual.nextCarry;
      carbsCarry = carbsVisual.nextCarry;
      caloriesCarry = caloriesVisual.nextCarry;

      data.push({
        date: label,
        proteinIntake: proteinVisual.intake,
        proteinDebt: proteinVisual.debtWithinLimit,
        proteinOverflow: proteinVisual.overflow,
        fatIntake: fatVisual.intake,
        fatDebt: fatVisual.debtWithinLimit,
        fatOverflow: fatVisual.overflow,
        carbsIntake: carbsVisual.intake,
        carbsDebt: carbsVisual.debtWithinLimit,
        carbsOverflow: carbsVisual.overflow,
        caloriesIntake: caloriesVisual.intake,
        caloriesDebt: caloriesVisual.debtWithinLimit,
        caloriesOverflow: caloriesVisual.overflow,
        pfcDebt: proteinVisual.debtWithinLimit + fatVisual.debtWithinLimit + carbsVisual.debtWithinLimit,
        pfcOverflow: proteinVisual.overflow + fatVisual.overflow + carbsVisual.overflow,
      });
    }

    return data;
  }, [days, windowStartDate, settings, debt]);

  if (chartData.length === 0) return null;

  const pfcTargetTotal = settings.targetPFC.protein + settings.targetPFC.fat + settings.targetPFC.carbs;

  return (
    <div className="space-y-4">
      <Card className="cursor-pointer" onClick={() => { setIsSplitView((prev) => !prev); }}>
        <CardHeader>
          <CardTitle>PFC積み上げグラフ（過去20日 / タップで栄養素別表示）</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 24, bottom: 0, left: -16 }} barCategoryGap="25%">
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
              <YAxis {...axisProps} width={44} />
              <Tooltip {...tooltipProps} />
              <ReferenceLine y={pfcTargetTotal} {...limitLineProps} label={limitLabel} />
              <Bar dataKey="proteinIntake" stackId="pfc" fill={nutrientColors.protein} name="タンパク質" />
              <Bar dataKey="fatIntake" stackId="pfc" fill={nutrientColors.fat} name="脂質" />
              <Bar dataKey="carbsIntake" stackId="pfc" fill={nutrientColors.carbs} name="炭水化物" />
              <Bar dataKey="pfcDebt" stackId="pfc" fill="var(--muted-foreground)" fillOpacity={0.18} name="負債(上限内)" />
              <Bar
                dataKey="pfcOverflow"
                stackId="pfc"
                fill={overLimitColor}
                fillOpacity={0.55}
                name="超過(翌日繰越)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {isSplitView && (
        <div className="grid gap-4 md:grid-cols-3">
          {(['protein', 'fat', 'carbs'] as const).map((nutrient) => (
            <NutrientChart
              key={nutrient}
              title={nutrientLabels[nutrient]}
              color={nutrientColors[nutrient]}
              target={settings.targetPFC[nutrient]}
              dataKeyPrefix={nutrient}
              data={chartData}
              unit="g"
            />
          ))}
        </div>
      )}

      <NutrientChart
        title="カロリー"
        color={nutrientColors.calories}
        target={settings.targetPFC.calories}
        dataKeyPrefix="calories"
        data={chartData}
        unit="kcal"
      />
    </div>
  );
}

function NutrientChart({
  title,
  color,
  target,
  dataKeyPrefix,
  data,
  unit,
}: {
  title: string;
  color: string;
  target: number;
  dataKeyPrefix: string;
  data: Record<string, number | string>[];
  unit: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 24, bottom: 0, left: -16 }} barCategoryGap="25%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...axisProps} width={44} />
            <Tooltip {...tooltipProps} formatter={(value: number) => [`${value.toFixed(1)} ${unit}`]} />
            <ReferenceLine y={target} {...limitLineProps} label={limitLabel} />
            <Bar dataKey={`${dataKeyPrefix}Intake`} stackId={dataKeyPrefix} fill={color} name="当日摂取" />
            <Bar dataKey={`${dataKeyPrefix}Debt`} stackId={dataKeyPrefix} fill={color} fillOpacity={0.25} name="負債(上限内)" />
            <Bar
              dataKey={`${dataKeyPrefix}Overflow`}
              stackId={dataKeyPrefix}
              fill={overLimitColor}
              fillOpacity={0.55}
              name="超過(翌日繰越)"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
