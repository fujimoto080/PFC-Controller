'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SportDefinition } from '@/lib/types';

interface SportSettingsFormProps {
  sports: SportDefinition[];
  onAddSport: (sport: SportDefinition) => void;
  onDeleteSport: (id: string) => void;
}

export function SportSettingsForm({
  sports,
  onAddSport,
  onDeleteSport,
}: SportSettingsFormProps) {
  const [name, setName] = useState('');
  const [caloriesBurned, setCaloriesBurned] = useState('');

  const handleAddSport = () => {
    const trimmedName = name.trim();
    const calories = Number(caloriesBurned);
    if (!trimmedName || !Number.isFinite(calories) || calories <= 0) return;

    onAddSport({
      id: `sport-${Date.now()}`,
      name: trimmedName,
      caloriesBurned: Math.round(calories),
    });
    setName('');
    setCaloriesBurned('');
  };

  return (
    <div className="mt-6 space-y-3 rounded-lg border p-4">
      <p className="text-sm font-semibold">スポーツ登録</p>

      <div className="space-y-2">
        <Label htmlFor="sport-name">スポーツ名</Label>
        <Input
          id="sport-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 水泳"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sport-calories">消費カロリー (kcal)</Label>
        <Input
          id="sport-calories"
          type="number"
          min={1}
          value={caloriesBurned}
          onChange={(e) => setCaloriesBurned(e.target.value)}
          placeholder="例: 300"
        />
      </div>

      <Button type="button" onClick={handleAddSport} className="w-full">
        スポーツを登録
      </Button>

      {sports.length > 0 && (
        <ul className="space-y-2">
          {sports.map((sport) => (
            <li
              key={sport.id}
              className="text-muted-foreground flex items-center justify-between rounded-md border px-2 py-1 text-xs"
            >
              <span>
                {sport.name}（{sport.caloriesBurned} kcal）
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => onDeleteSport(sport.id)}
              >
                削除
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
