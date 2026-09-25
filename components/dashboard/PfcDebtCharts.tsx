'use client';

import { useMemo, useState } from 'react';
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
import { useAppState } from '@/lib/client/store';
import {
  CALORIES_CHART_COLOR,
  MACROS,
  PFC_KEYS,
  type PfcKey,
} from '@/lib/macros';
import { computePfcDebt } from '@/lib/pfc';
import { EMPTY_PFC, type Logs, type PFC } from '@/lib/types';
import { shiftDate } from '@/lib/utils';

const DAYS = 20;

type ChartRow = Record<string, number | string>;

const overLimitColor = 'var(--destructive)';

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--muted-foreground)', fontSize: 11 },
  tickMargin: 8,
} as const;

const barChartProps = {
  margin: { top: 8, right: 24, bottom: 0, left: -16 },
  barCategoryGap: '25%',
} as const;

const xAxisProps = {
  ...axisProps,
  dataKey: 'date',
  interval: 'preserveStartEnd',
  minTickGap: 16,
} as const;

const yAxisProps = { ...axisProps, width: 44 } as const;

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
  labelStyle: {
    color: 'var(--muted-foreground)',
    fontSize: 11,
    marginBottom: 4,
  },
  itemStyle: { padding: 0 },
} as const;

const limitLineProps = {
  stroke: overLimitColor,
  strokeWidth: 1,
  strokeDasharray: '3 3',
  label: {
    value: '上限',
    position: 'right',
    fill: overLimitColor,
    fontSize: 10,
  },
} as const;

const overflowBarProps = {
  fill: overLimitColor,
  fillOpacity: 0.55,
  name: '超過(翌日繰越)',
  radius: [3, 3, 0, 0] as [number, number, number, number],
};

/** YYYY-MM-DD を M/d 表記にする。 */
function toAxisLabel(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${month}/${day}`;
}

/**
 * endDate までの DAYS 日分について、栄養素ごとに
 * 「上限内の当日摂取 / 上限内に収まる前日までの負債 / 上限超過（翌日へ繰越）」を積み上げ用に分解する。
 */
function buildChartData(logs: Logs, target: PFC, endDate: string): ChartRow[] {
  const startDate = shiftDate(endDate, -(DAYS - 1));
  const carry = computePfcDebt(startDate, target, logs);

  return Array.from({ length: DAYS }, (_, i) => {
    const date = shiftDate(startDate, i);
    const total = logs[date]?.total ?? EMPTY_PFC;
    const row: ChartRow = { date: toAxisLabel(date) };

    for (const key of PFC_KEYS) {
      const limit = Math.max(1, target[key]);
      const intake = Math.min(total[key], limit);
      const overflow = Math.max(0, total[key] + carry[key] - limit);
      row[`${key}Intake`] = intake;
      row[`${key}Debt`] = Math.min(carry[key], limit - intake);
      row[`${key}Overflow`] = overflow;
      carry[key] = overflow;
    }

    const sumOverMacros = (suffix: string) =>
      MACROS.reduce((acc, { key }) => acc + Number(row[`${key}${suffix}`]), 0);
    row.pfcDebt = sumOverMacros('Debt');
    row.pfcOverflow = sumOverMacros('Overflow');
    return row;
  });
}

export function PfcDebtCharts({ referenceDate }: { referenceDate: string }) {
  const [isSplitView, setIsSplitView] = useState(false);
  const { logs, settings } = useAppState();
  const { targetPFC } = settings;
  const chartData = useMemo(
    () => buildChartData(logs, targetPFC, referenceDate),
    [logs, targetPFC, referenceDate],
  );

  const pfcTargetTotal = MACROS.reduce(
    (acc, { key }) => acc + targetPFC[key],
    0,
  );

  return (
    <div className="space-y-4">
      <Card
        className="cursor-pointer"
        onClick={() => {
          setIsSplitView((prev) => !prev);
        }}
      >
        <CardHeader>
          <CardTitle>
            PFC積み上げグラフ（過去{DAYS}日 / タップで栄養素別表示）
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} {...barChartProps}>
              <CartesianGrid {...gridProps} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip {...tooltipProps} />
              <ReferenceLine y={pfcTargetTotal} {...limitLineProps} />
              {MACROS.map(({ key, label, chartColor }) => (
                <Bar
                  key={key}
                  dataKey={`${key}Intake`}
                  stackId="pfc"
                  fill={chartColor}
                  name={label}
                />
              ))}
              <Bar
                dataKey="pfcDebt"
                stackId="pfc"
                fill="var(--muted-foreground)"
                fillOpacity={0.18}
                name="負債(上限内)"
              />
              <Bar dataKey="pfcOverflow" stackId="pfc" {...overflowBarProps} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {isSplitView && (
        <div className="grid gap-4 md:grid-cols-3">
          {MACROS.map(({ key, label, chartColor }) => (
            <NutrientChart
              key={key}
              title={label}
              color={chartColor}
              target={targetPFC[key]}
              nutrient={key}
              data={chartData}
              unit="g"
            />
          ))}
        </div>
      )}

      <NutrientChart
        title="カロリー"
        color={CALORIES_CHART_COLOR}
        target={targetPFC.calories}
        nutrient="calories"
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
  nutrient,
  data,
  unit,
}: {
  title: string;
  color: string;
  target: number;
  nutrient: PfcKey;
  data: ChartRow[];
  unit: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} {...barChartProps}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip
              {...tooltipProps}
              formatter={(value) => [`${Number(value).toFixed(1)} ${unit}`]}
            />
            <ReferenceLine y={target} {...limitLineProps} />
            <Bar
              dataKey={`${nutrient}Intake`}
              stackId={nutrient}
              fill={color}
              name="当日摂取"
            />
            <Bar
              dataKey={`${nutrient}Debt`}
              stackId={nutrient}
              fill={color}
              fillOpacity={0.25}
              name="負債(上限内)"
            />
            <Bar
              dataKey={`${nutrient}Overflow`}
              stackId={nutrient}
              {...overflowBarProps}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
