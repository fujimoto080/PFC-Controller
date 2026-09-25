'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveSports } from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';

/** スポーツと1回あたりの消費カロリーの登録。今日画面から記録すると、その日の上限に加算される。 */
export function SportSettingsPanel() {
  const { sports } = useAppState();
  const [name, setName] = useState('');
  const [caloriesBurned, setCaloriesBurned] = useState('');

  const trimmedName = name.trim();
  const calories = Math.round(Number(caloriesBurned));
  const canAdd =
    trimmedName !== '' && Number.isFinite(calories) && calories > 0;

  const handleAdd = async () => {
    if (!canAdd) return;
    const ok = await saveSports([
      ...sports,
      { id: crypto.randomUUID(), name: trimmedName, caloriesBurned: calories },
    ]);
    if (ok) {
      setName('');
      setCaloriesBurned('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>スポーツ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleAdd();
          }}
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="sport-name">スポーツ名</Label>
            <Input
              id="sport-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              placeholder="例: 水泳 30分"
            />
          </div>
          <div className="w-24 space-y-1.5">
            <Label htmlFor="sport-calories">消費 kcal</Label>
            <Input
              id="sport-calories"
              type="number"
              inputMode="numeric"
              min={1}
              value={caloriesBurned}
              onChange={(e) => {
                setCaloriesBurned(e.target.value);
              }}
              placeholder="300"
            />
          </div>
          <Button type="submit" disabled={!canAdd}>
            登録
          </Button>
        </form>

        {sports.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {sports.map((sport) => (
              <li
                key={sport.id}
                className="flex items-center gap-3 px-3 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {sport.name}
                </span>
                <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                  {sport.caloriesBurned} kcal
                </span>
                <IconButton
                  aria-label={`${sport.name}を削除`}
                  onClick={() => {
                    void saveSports(sports.filter((s) => s.id !== sport.id));
                  }}
                >
                  <X />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
