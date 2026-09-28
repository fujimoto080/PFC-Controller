'use client';

import { useEffect, useState } from 'react';
import {
  ChevronRight,
  Loader2,
  RefreshCw,
  Sparkles,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoSaveIndicator } from '@/components/settings/AutoSaveIndicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAutoSave } from '@/hooks/use-auto-save';
import { PageTitle } from '@/components/ui/page-title';
import {
  fetchMealNote,
  fetchMealSuggestions,
  requestMealSuggestions,
  saveMealNote,
} from '@/lib/client/api';
import { getCurrentPosition } from '@/lib/client/device';
import { useAppState } from '@/lib/client/store';
import {
  MEAL_SLOTS,
  mealSlotLabel,
  remainingSlots,
  slotForTime,
} from '@/lib/meal-schedule';
import { computeDailyLimit, subtractPFC } from '@/lib/pfc';
import { toast } from '@/lib/toast';
import {
  EMPTY_PFC,
  MEAL_SUGGESTION_AVOID_LIMIT,
  type MealSlot,
  type MealSuggestion,
  type NearbyStore,
} from '@/lib/types';
import { formatDate, formatTime } from '@/lib/utils';
import { StorePicker } from './StorePicker';
import { SuggestionOptionCard } from './SuggestionOptionCard';

/** 今日の残りと予定・現在地から、AI に朝昼晩の食事をまとめて提案させ、食事ごとに提案し直せる画面。 */
export function MealSuggestView() {
  // 今日の提案すべて（新しい順）。やり直しても前の提案は残す
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  // 提案を考えている最中の食事枠
  const [loadingSlots, setLoadingSlots] = useState<MealSlot[]>([]);
  // 今日の予定・気分。読み込むまでは null
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fetchMealSuggestions()
      .then(setSuggestions)
      .catch((error: unknown) => {
        toast.fromError('提案の読み込みに失敗しました', error);
      });
    fetchMealNote()
      .then((data) => {
        setNote(data.note);
      })
      .catch((error: unknown) => {
        toast.fromError('今日の予定・気分の読み込みに失敗しました', error);
        setNote('');
      });
  }, []);

  /** slot 指定時はその食事だけ、省略時は今日これからの食事をまとめて提案させる。 */
  const generate = async (request: {
    slot?: MealSlot;
    stores?: NearbyStore[];
    avoid?: string[];
  }) => {
    const slots = request.slot
      ? [request.slot]
      : remainingSlots(slotForTime(Date.now()));
    setLoadingSlots((prev) => [...prev, ...slots]);
    try {
      // サーバーは保存済みの予定・気分を使うので、自動保存を待たずに保存しておく
      const [location] = await Promise.all([
        getCurrentPosition(),
        note === null ? undefined : saveMealNote({ note }),
      ]);
      if (!location) toast.info('現在地を取得できないため、予定から考えます');
      const created = await requestMealSuggestions({ location, ...request });
      setSuggestions((prev) => [...created, ...prev]);
    } catch (error) {
      toast.fromError('提案に失敗しました', error);
    } finally {
      setLoadingSlots((prev) => prev.filter((s) => !slots.includes(s)));
    }
  };

  return (
    <div className="space-y-5">
      <PageTitle className="mb-0">食事の提案</PageTitle>

      <RemainingLine />

      {note !== null && <MealNoteCard note={note} onChange={setNote} />}

      <Button
        className="w-full"
        disabled={loadingSlots.length > 0}
        onClick={() => {
          void generate({});
        }}
      >
        <Sparkles />
        今日の食事をまとめて提案してもらう
      </Button>

      {MEAL_SLOTS.map(({ slot }) => (
        <SlotSection
          key={slot}
          slot={slot}
          suggestions={suggestions.filter((s) => s.slot === slot)}
          loading={loadingSlots.includes(slot)}
          onGenerate={(request) => {
            void generate({ slot, ...request });
          }}
        />
      ))}
    </div>
  );
}

/** 今日の予定・気分。入力すると自動保存し、今日の提案（やり直し・朝の通知も）すべてで使う。 */
function MealNoteCard({
  note,
  onChange,
}: {
  note: string;
  onChange: (note: string) => void;
}) {
  const status = useAutoSave(note.trim(), async (value) => {
    try {
      await saveMealNote({ note: value });
      return true;
    } catch (error) {
      toast.fromError('今日の予定・気分の保存に失敗しました', error);
      return false;
    }
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <label htmlFor="meal-note">今日の予定・気分</label>
        </CardTitle>
        <AutoSaveIndicator status={status} />
      </CardHeader>
      <CardContent>
        <Textarea
          id="meal-note"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder="例: 13時から外出、夜は飲み会。麺が食べたい"
        />
      </CardContent>
    </Card>
  );
}

/** 1 食分の提案。最新の提案と、その食事だけの提案し直し・前の提案を表示する。 */
function SlotSection({
  slot,
  suggestions,
  loading,
  onGenerate,
}: {
  slot: MealSlot;
  /** この食事枠の今日の提案（新しい順） */
  suggestions: MealSuggestion[];
  loading: boolean;
  onGenerate: (request: { stores?: NearbyStore[]; avoid?: string[] }) => void;
}) {
  const [pickingStores, setPickingStores] = useState(false);
  const [current, ...previous] = suggestions;

  const generate = (request: { stores?: NearbyStore[]; avoid?: string[] }) => {
    setPickingStores(false);
    onGenerate(request);
  };

  // 今日この食事枠で出した案すべてを避けさせ、同じ案に戻らないようにする
  const retry = () => {
    generate({
      avoid: suggestions
        .flatMap((s) => s.options)
        .map((o) =>
          `${o.store} ${o.items.map((i) => i.name).join('＋')}`.slice(
            0,
            MEAL_SUGGESTION_AVOID_LIMIT.length,
          ),
        )
        .slice(0, MEAL_SUGGESTION_AVOID_LIMIT.count),
    });
  };

  return (
    <section className="space-y-3 border-t pt-4">
      <header className="flex items-center gap-2">
        <h2 className="flex-1 font-semibold">{mealSlotLabel(slot)}</h2>
        {current && current.stores.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            aria-pressed={pickingStores}
            onClick={() => {
              setPickingStores((open) => !open);
            }}
          >
            <Store />
            お店を選ぶ
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => {
            if (current) retry();
            else generate({});
          }}
        >
          {current ? <RefreshCw /> : <Sparkles />}
          {current ? '別の案' : '提案してもらう'}
        </Button>
      </header>

      {pickingStores && current && (
        <StorePicker
          stores={current.stores}
          onSubmit={(stores) => {
            generate({ stores });
          }}
        />
      )}

      {/* 考えている間も前の提案は見られるよう、読み込み表示は一覧の上に出す */}
      {loading && (
        <p className="bg-muted/50 flex items-center justify-center gap-2 rounded-xl py-6 text-sm">
          <Loader2 className="size-4 animate-spin" />
          近くのお店と新商品を調べて考えています…（30秒〜1分ほど）
        </p>
      )}

      {current ? (
        <SuggestionSection suggestion={current} />
      ) : (
        !loading && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            まだ提案はありません。
          </p>
        )
      )}

      {previous.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-medium">
            前の提案（{previous.length}件）
          </h3>
          {previous.map((suggestion) => (
            <details
              key={suggestion.createdAt}
              className="group rounded-xl border"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm">
                <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90" />
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {formatTime(suggestion.createdAt)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {suggestion.options.map((o) => o.store).join(' / ')}
                </span>
              </summary>
              <div className="px-3 pb-3">
                <SuggestionSection suggestion={suggestion} />
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

/** 1 回分の提案（3 案と参照した情報）。 */
function SuggestionSection({ suggestion }: { suggestion: MealSuggestion }) {
  return (
    <section className="space-y-3">
      <p className="text-muted-foreground text-xs">
        {formatTime(suggestion.createdAt)} の提案
      </p>
      {suggestion.options.map((option, index) => (
        <SuggestionOptionCard key={index} option={option} />
      ))}
      {suggestion.sources.length > 0 && (
        <details className="text-muted-foreground text-xs">
          <summary>参照した情報</summary>
          <ul className="mt-1 space-y-1">
            {suggestion.sources.map((source) => (
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
  );
}

/** 今日の残り（上限 - 摂取済み）。記録すると即座に反映される。 */
function RemainingLine() {
  const { logs, settings } = useAppState();
  const [today] = useState(() => formatDate(Date.now()));
  const { limit } = computeDailyLimit(today, settings, logs);
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
