'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageTitle } from '@/components/ui/page-title';
import { fetchMealSuggestions, requestMealSuggestion } from '@/lib/client/api';
import { getCurrentPosition } from '@/lib/client/device';
import { useAppState } from '@/lib/client/store';
import { MEAL_SLOTS, mealSlotLabel, slotForTime } from '@/lib/meal-schedule';
import { computeDailyLimit, subtractPFC } from '@/lib/pfc';
import { toast } from '@/lib/toast';
import {
  EMPTY_PFC,
  type MealSlot,
  type MealSuggestion,
  type NearbyStore,
} from '@/lib/types';
import { cn, formatDate, formatTime } from '@/lib/utils';
import { StorePicker } from './StorePicker';
import { SuggestionOptionCard } from './SuggestionOptionCard';

interface Props {
  initialSlot?: MealSlot;
}

/** 今日の残りと予定・現在地から、AI に朝昼晩の食事を提案させる画面。 */
export function MealSuggestView({ initialSlot }: Props) {
  const [slot, setSlot] = useState<MealSlot>(
    () => initialSlot ?? slotForTime(Date.now()),
  );
  const [suggestions, setSuggestions] = useState<
    Partial<Record<MealSlot, MealSuggestion>>
  >({});
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [pickingStores, setPickingStores] = useState(false);

  useEffect(() => {
    fetchMealSuggestions()
      .then((list) => {
        setSuggestions(Object.fromEntries(list.map((s) => [s.slot, s])));
      })
      .catch((error: unknown) => {
        toast.fromError('提案の読み込みに失敗しました', error);
      });
  }, []);

  const current = suggestions[slot];

  const generate = async (options: {
    stores?: NearbyStore[];
    avoid?: string[];
  }) => {
    setLoading(true);
    setPickingStores(false);
    try {
      const location = await getCurrentPosition();
      if (!location) toast.info('現在地を取得できないため、予定から考えます');
      const suggestion = await requestMealSuggestion({
        slot,
        location,
        note: note.trim() || undefined,
        ...options,
      });
      setSuggestions((prev) => ({ ...prev, [slot]: suggestion }));
    } catch (error) {
      toast.fromError('提案に失敗しました', error);
    } finally {
      setLoading(false);
    }
  };

  const retry = () => {
    void generate({
      avoid: current?.options.map(
        (o) => `${o.store} ${o.items.map((i) => i.name).join('＋')}`,
      ),
    });
  };

  return (
    <div className="space-y-5">
      <PageTitle className="mb-0">食事の提案</PageTitle>

      <RemainingLine />

      <div className="flex gap-1 rounded-lg border p-1">
        {MEAL_SLOTS.map((meta) => (
          <button
            key={meta.slot}
            type="button"
            aria-pressed={slot === meta.slot}
            className={cn(
              'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
              slot === meta.slot
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
            onClick={() => {
              setSlot(meta.slot);
              setPickingStores(false);
            }}
          >
            {meta.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Input
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
          }}
          placeholder="今日の予定・気分（例: 13時から外出、麺が食べたい）"
        />
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={loading}
            onClick={() => {
              void generate({});
            }}
          >
            <Sparkles />
            {current
              ? '最初から提案し直す'
              : `${mealSlotLabel(slot)}を提案してもらう`}
          </Button>
          {current && (
            <Button variant="outline" disabled={loading} onClick={retry}>
              <RefreshCw />
              別の案
            </Button>
          )}
        </div>
        {current && current.stores.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={loading}
            onClick={() => {
              setPickingStores((open) => !open);
            }}
          >
            <Store />
            近くのお店から選んで提案
          </Button>
        )}
      </div>

      {pickingStores && current && (
        <StorePicker
          stores={current.stores}
          onSubmit={(stores) => {
            void generate({ stores });
          }}
        />
      )}

      {loading ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          近くのお店と新商品を調べて考えています…（30秒〜1分ほど）
        </p>
      ) : current ? (
        <section className="space-y-3">
          <p className="text-muted-foreground text-xs">
            {formatTime(current.createdAt)} の提案
          </p>
          {current.options.map((option, index) => (
            <SuggestionOptionCard key={index} option={option} />
          ))}
          {current.sources.length > 0 && (
            <details className="text-muted-foreground text-xs">
              <summary>参照した情報</summary>
              <ul className="mt-1 space-y-1">
                {current.sources.map((source) => (
                  <li key={source.url} className="truncate">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      ) : (
        <p className="text-muted-foreground py-10 text-center text-sm">
          まだ提案はありません。
        </p>
      )}
    </div>
  );
}

/** 今日の残り（上限 - 摂取済み）。記録すると即座に反映される。 */
function RemainingLine() {
  const { logs, settings } = useAppState();
  const [today] = useState(() => formatDate(Date.now()));
  const { limit } = computeDailyLimit(today, settings.targetPFC, logs);
  const remaining = subtractPFC(limit, logs[today]?.total ?? EMPTY_PFC);
  return (
    <p className="text-muted-foreground text-sm">
      今日の残り{' '}
      <span className="text-foreground font-semibold tabular-nums">
        {Math.round(remaining.calories)}kcal
      </span>{' '}
      P{Math.round(remaining.protein)} F{Math.round(remaining.fat)} C
      {Math.round(remaining.carbs)}
    </p>
  );
}
