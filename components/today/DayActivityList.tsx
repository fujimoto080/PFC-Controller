'use client';

import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { addSportActivity, deleteSportActivity } from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';
import { toast } from '@/lib/toast';
import { formatTime, roundPFC } from '@/lib/utils';

/** 選択日の運動記録。登録済みスポーツをワンタップで記録でき、消費分だけその日の上限が増える。 */
export function DayActivityList({ date }: { date: string }) {
  const { logs, sports } = useAppState();
  const activities = [...(logs[date]?.activities ?? [])].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

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
        <div className="flex flex-col gap-2">
          {sports.map((sport) => (
            <button
              key={sport.id}
              type="button"
              className="bg-card hover:bg-muted/60 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-left text-sm transition-transform active:scale-[0.98]"
              onClick={() => {
                void addSportActivity(date, sport);
                toast.success(`${sport.name}を記録しました`);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="min-w-0 flex-1 truncate">{sport.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {sport.caloriesBurned}kcal
              </span>
            </button>
          ))}
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
