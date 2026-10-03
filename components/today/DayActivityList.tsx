'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SportIcon } from '@/components/SportIcon';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import {
  addSportActivity,
  deleteSportActivity,
  isTempId,
} from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';
import { DEFAULT_PROFILE } from '@/lib/nutrition-goals';
import {
  DEFAULT_SPORT_INTENSITY,
  DEFAULT_SPORT_MINUTES,
  SPORT_INTENSITIES,
  calculateSportCalories,
  type SportIntensity,
} from '@/lib/sports';
import { toast } from '@/lib/toast';
import { cn, formatTime, roundPFC } from '@/lib/utils';

/** 選択日の運動記録。登録スポーツを選び、強度と時間を指定して記録すると、消費分だけその日の上限が増える。 */
export function DayActivityList({ date }: { date: string }) {
  const { logs, sports, settings } = useAppState();
  const [sportId, setSportId] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<SportIntensity>(
    DEFAULT_SPORT_INTENSITY,
  );
  const [minutesInput, setMinutesInput] = useState(
    String(DEFAULT_SPORT_MINUTES),
  );
  const activities = [...(logs[date]?.activities ?? [])].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  const sport = sports.find((s) => s.id === sportId);
  const minutes = Math.round(Number(minutesInput));
  const canRecord =
    sport !== undefined && Number.isFinite(minutes) && minutes > 0;
  const previewCalories = canRecord
    ? calculateSportCalories({
        mets: sport.mets,
        intensity,
        minutes,
        weight: (settings.profile ?? DEFAULT_PROFILE).weight,
      })
    : 0;

  const handleRecord = () => {
    if (!canRecord) return;
    const saving = addSportActivity(date, sport, { intensity, minutes });
    toast.success(`${sport.name}を記録しました`, {
      action: {
        label: '取り消す',
        // 保存完了を待ってから、確定した ID で削除する
        onClick: () => {
          void saving.then((id) => {
            if (id) void deleteSportActivity(date, id);
          });
        },
      },
    });
  };

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">運動</h2>

      {sports.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          <Link href="/settings" className="underline underline-offset-2">
            設定
          </Link>
          でスポーツを登録すると、ここから記録できます。
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {sports.map((s) => (
              <Button
                key={s.id}
                type="button"
                size="sm"
                variant={s.id === sportId ? 'default' : 'outline'}
                onClick={() => {
                  setSportId(s.id);
                }}
              >
                <SportIcon name={s.name} />
                {s.name}
              </Button>
            ))}
          </div>

          {sport && (
            <div className="bg-card space-y-3 rounded-lg border p-3">
              <div className="flex gap-1.5">
                {SPORT_INTENSITIES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={cn(
                      'flex-1 rounded-md border px-2 py-1.5 text-sm transition-colors',
                      value === intensity
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-muted/60',
                    )}
                    onClick={() => {
                      setIntensity(value);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  aria-label="運動時間（分）"
                  className="w-24"
                  value={minutesInput}
                  onChange={(e) => {
                    setMinutesInput(e.target.value);
                  }}
                />
                <span className="text-sm">分</span>
                <span className="text-muted-foreground ml-auto text-sm tabular-nums">
                  +{previewCalories} kcal
                </span>
                <Button
                  type="button"
                  data-track="運動を記録"
                  disabled={!canRecord}
                  onClick={handleRecord}
                >
                  <Plus /> 記録
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {activities.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {activities.map((activity) => (
            <li
              key={activity.id}
              className="flex items-center gap-3 px-3 py-1.5"
            >
              <span className="text-muted-foreground w-10 shrink-0 text-xs tabular-nums">
                {formatTime(activity.timestamp)}
              </span>
              <SportIcon
                name={activity.name}
                className="text-muted-foreground size-4 shrink-0"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {activity.name}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                +{roundPFC(activity.caloriesBurned, 0)}
                <span className="text-muted-foreground ml-0.5 text-xs font-normal">
                  kcal
                </span>
              </span>
              <IconButton
                aria-label={`${activity.name}の記録を削除`}
                data-track="運動の記録を削除"
                disabled={isTempId(activity.id)}
                onClick={() => {
                  void deleteSportActivity(date, activity.id);
                }}
              >
                <X />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
