'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAutoSave } from '@/hooks/use-auto-save';
import { updateSettings } from '@/lib/client/actions';
import {
  getCurrentPosition,
  getPushSubscription,
  isPushSupported,
  subscribePush,
  unsubscribePush,
} from '@/lib/client/device';
import { useAppState } from '@/lib/client/store';
import {
  DEFAULT_MEAL_SCHEDULE,
  MEAL_SLOTS,
  WEEKDAY_LABELS,
} from '@/lib/meal-schedule';
import { toast } from '@/lib/toast';
import type { MealSchedule, NamedPlace } from '@/lib/types';
import { cn, toggleItem } from '@/lib/utils';
import { AutoSaveIndicator } from './AutoSaveIndicator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 食事提案で居場所を推定するための予定と、朝昼晩の提案通知の設定。 */
export function MealSuggestionSettingsPanel() {
  const { settings } = useAppState();
  const [schedule, setSchedule] = useState<MealSchedule>(
    settings.mealSchedule ?? DEFAULT_MEAL_SCHEDULE,
  );
  const update = (patch: Partial<MealSchedule>) => {
    setSchedule((current) => ({ ...current, ...patch }));
  };

  // 時刻欄を消している途中は保存しない
  const status = useAutoSave(
    { mealSchedule: schedule },
    updateSettings,
    [schedule.workStart, schedule.workEnd].every((t) => HHMM.test(t)),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>食事の提案</CardTitle>
        <AutoSaveIndicator status={status} />
      </CardHeader>
      <CardContent className="space-y-5">
        <PushToggle />

        <PlaceField
          id="home"
          title="自宅"
          place={schedule.home}
          onChange={(home) => {
            update({ home });
          }}
        />
        <PlaceField
          id="office"
          title="会社"
          place={schedule.office}
          onChange={(office) => {
            update({ office });
          }}
        />

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="work-start">始業</Label>
            <Input
              id="work-start"
              type="time"
              value={schedule.workStart}
              onChange={(e) => {
                update({ workStart: e.target.value });
              }}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="work-end">終業</Label>
            <Input
              id="work-end"
              type="time"
              value={schedule.workEnd}
              onChange={(e) => {
                update({ workEnd: e.target.value });
              }}
            />
          </div>
        </div>

        <WeekdayPicker
          label="仕事の日"
          selected={schedule.workDays}
          onToggle={(day) => {
            update({ workDays: toggleItem(schedule.workDays, day) });
          }}
        />
        <WeekdayPicker
          label="うち在宅勤務の日"
          selected={schedule.remoteDays}
          enabled={schedule.workDays}
          onToggle={(day) => {
            update({ remoteDays: toggleItem(schedule.remoteDays, day) });
          }}
        />
      </CardContent>
    </Card>
  );
}

function PushToggle() {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getPushSubscription().then((subscription) => {
      setSubscribed(subscription !== null);
    });
  }, []);

  if (!isPushSupported()) {
    return (
      <p className="text-muted-foreground text-sm">
        この端末・ブラウザは通知に対応していません。
      </p>
    );
  }

  const toggle = async () => {
    setBusy(true);
    try {
      if (subscribed) {
        await unsubscribePush();
        setSubscribed(false);
        toast.success('通知をオフにしました');
      } else {
        await subscribePush();
        setSubscribed(true);
        toast.success('通知をオンにしました');
      }
    } catch (error) {
      toast.fromError('通知の設定に失敗しました', error);
    } finally {
      setBusy(false);
    }
  };

  const times = MEAL_SLOTS.map((meta) => `${meta.short} ${meta.time}`).join(
    ' / ',
  );
  return (
    <div className="flex items-center gap-3">
      <p className="text-muted-foreground min-w-0 flex-1 text-sm">
        毎日 {times} ごろに提案を通知します。
      </p>
      <Button
        variant={subscribed ? 'outline' : 'default'}
        disabled={busy || subscribed === null}
        onClick={() => {
          void toggle();
        }}
      >
        {subscribed ? <BellOff /> : <Bell />}
        {subscribed ? 'オフにする' : 'オンにする'}
      </Button>
    </div>
  );
}

function PlaceField({
  id,
  title,
  place,
  onChange,
}: {
  id: string;
  title: string;
  place: NamedPlace;
  onChange: (place: NamedPlace) => void;
}) {
  const [locating, setLocating] = useState(false);

  const setHere = async () => {
    setLocating(true);
    const point = await getCurrentPosition();
    setLocating(false);
    if (!point) {
      toast.error('現在地を取得できませんでした');
      return;
    }
    onChange({ ...place, point });
    toast.success(`現在地を${title}に設定しました`);
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`place-${id}`}>{title}</Label>
      <div className="flex gap-2">
        <Input
          id={`place-${id}`}
          value={place.label}
          onChange={(e) => {
            onChange({ ...place, label: e.target.value });
          }}
          placeholder={`例: ${title}（最寄り駅など）`}
        />
        <Button
          variant="outline"
          disabled={locating}
          onClick={() => {
            void setHere();
          }}
        >
          <MapPin />
          現在地
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {place.point
          ? `位置: ${place.point.lat.toFixed(4)}, ${place.point.lon.toFixed(4)}`
          : '位置は未設定（その場所にいるときに「現在地」を押す）'}
      </p>
    </div>
  );
}

function WeekdayPicker({
  label,
  selected,
  enabled,
  onToggle,
}: {
  label: string;
  selected: number[];
  /** 指定時はこの曜日だけ選べる */
  enabled?: number[];
  onToggle: (day: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex gap-1">
        {WEEKDAY_LABELS.map((dayLabel, day) => {
          const disabled = enabled !== undefined && !enabled.includes(day);
          const active = selected.includes(day) && !disabled;
          return (
            <button
              key={dayLabel}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              className={cn(
                'h-9 flex-1 rounded-md border text-sm transition-colors disabled:opacity-40',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-muted',
              )}
              onClick={() => {
                onToggle(day);
              }}
            >
              {dayLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
