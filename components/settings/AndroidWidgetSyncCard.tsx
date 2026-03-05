'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getTodayLog, getTodayString } from '@/lib/storage';

const formatValue = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
};

const createWidgetSyncUrl = () => {
  const today = getTodayLog();
  const date = getTodayString();
  const params = new URLSearchParams({
    calories: formatValue(today.total.calories),
    protein: formatValue(today.total.protein),
    fat: formatValue(today.total.fat),
    carbs: formatValue(today.total.carbs),
    date,
  });

  return `intent://sync?${params.toString()}#Intent;scheme=pfcwidget;package=app.vercel.pfc_controller.twa;end`;
};

export function AndroidWidgetSyncCard() {
  const handleClick = () => {
    window.location.href = createWidgetSyncUrl();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Androidウィジェット同期</CardTitle>
        <CardDescription>
          今日の摂取カロリーとPFCをAndroidホーム画面ウィジェットに反映します。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={handleClick}>
          ウィジェットに同期
        </Button>
      </CardContent>
    </Card>
  );
}
