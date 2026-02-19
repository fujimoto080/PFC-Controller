'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { deleteSportActivity, addSportActivity } from '@/lib/storage';
import { SportActivityLog, SportDefinition } from '@/lib/types';

interface SportActivityControlsProps {
  date: string;
  sports: SportDefinition[];
  activities: SportActivityLog[];
}

export function SportActivityControls({
  date,
  sports,
  activities,
}: SportActivityControlsProps) {
  const [selectedSportId, setSelectedSportId] = useState('');

  const selectedSport = useMemo(
    () => sports.find((sport) => sport.id === selectedSportId),
    [selectedSportId, sports],
  );

  const handleAddActivity = () => {
    if (!selectedSport) return;
    addSportActivity(date, selectedSport);
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">スポーツ消費カロリー</p>
      <div className="flex gap-2">
        <Select value={selectedSportId} onValueChange={setSelectedSportId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="スポーツを選択" />
          </SelectTrigger>
          <SelectContent>
            {sports.map((sport) => (
              <SelectItem key={sport.id} value={sport.id}>
                {sport.name}（{sport.caloriesBurned} kcal）
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleAddActivity} disabled={!selectedSport}>
          追加
        </Button>
      </div>

      {activities.length > 0 && (
        <ul className="space-y-1">
          {activities.map((activity) => (
            <li
              key={`${activity.timestamp}-${activity.id}`}
              className="text-muted-foreground flex items-center justify-between text-xs"
            >
              <span>
                {activity.name}（+{activity.caloriesBurned} kcal）
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => deleteSportActivity(date, activity.timestamp)}
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
