'use client';

import { useState } from 'react';
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
import { useCollapsedKeys } from '@/hooks/use-collapsed-keys';
import { PageTitle } from '@/components/ui/page-title';
import {
  requestMealSuggestions,
  saveMealNote,
  saveMealSplit,
  todayMeal,
} from '@/lib/client/actions';
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
  type MealSplit,
  type MealSuggestion,
  type NearbyStore,
} from '@/lib/types';
import { formatDate, formatTime } from '@/lib/utils';
import { CatalogCombinations } from './CatalogCombinations';
import { MealSplitBar } from './MealSplitBar';
import { StorePicker } from './StorePicker';
import { SuggestionOptionCard } from './SuggestionOptionCard';

// 畳んでいる食事枠を「日付:食事枠」のキーで保存し、その日のあいだ畳んだままにする
const COLLAPSED_STORAGE_KEY = 'pfc_meal_suggest_collapsed';

/** 今日の残りと予定・現在地から、AI に朝昼晩の食事をまとめて提案させ、食事ごとに提案し直せる画面。 */
export function MealSuggestView({
  catalogSources,
}: {
  /** AI なしの組み合わせで選べるお店 */
  catalogSources: { id: string; name: string }[];
}) {
  const meal = todayMeal(useAppState().meal);
  // 提案を考えている最中の食事枠
  const [loadingSlots, setLoadingSlots] = useState<MealSlot[]>([]);
  // 入力中の今日の予定・気分。入力が止まると自動保存する
  const [note, setNote] = useState(meal.note);
  // 調整中の朝昼晩の配分。動かすと自動保存する
  const [split, setSplit] = useState(meal.split);
  const collapsedKey = (slot: MealSlot) => `${meal.date}:${slot}`;
  // 前日までに畳んだ分は読み込み時に捨てる
  const collapsed = useCollapsedKeys(COLLAPSED_STORAGE_KEY, (key) =>
    key.startsWith(`${meal.date}:`),
  );

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
      const [location, noteSaved, splitSaved] = await Promise.all([
        getCurrentPosition(),
        saveMealNote(note.trim()),
        saveMealSplit(split),
      ]);
      if (!noteSaved || !splitSaved) return;
      if (!location) toast.info('現在地を取得できないため、予定から考えます');
      await requestMealSuggestions({ location, ...request });
    } catch (error) {
      toast.fromError('提案に失敗しました', error);
    } finally {
      setLoadingSlots((prev) => prev.filter((s) => !slots.includes(s)));
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle className="mb-0">食事の提案</PageTitle>

      <RemainingLine />

      <MealNoteCard note={note} onChange={setNote} />

      <MealSplitCard split={split} onChange={setSplit} />

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

      <CatalogCombinations sources={catalogSources} />

      {MEAL_SLOTS.map(({ slot }) => (
        <SlotSection
          key={slot}
          slot={slot}
          suggestions={meal.suggestions.filter((s) => s.slot === slot)}
          loading={loadingSlots.includes(slot)}
          collapsed={collapsed.isCollapsed(collapsedKey(slot))}
          onToggleCollapsed={() => {
            collapsed.toggle(collapsedKey(slot));
          }}
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
  const status = useAutoSave(note.trim(), saveMealNote);
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle>
          <label htmlFor="meal-note">今日の予定・気分</label>
        </CardTitle>
        <AutoSaveIndicator status={status} />
      </CardHeader>
      <CardContent className="px-4">
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

/** 朝昼晩のカロリー上限の配分。バーの2本の線を動かすと自動保存し、その日の提案すべてで AI に渡す。 */
function MealSplitCard({
  split,
  onChange,
}: {
  split: MealSplit;
  onChange: (split: MealSplit) => void;
}) {
  const status = useAutoSave(split, saveMealSplit);
  const { limit } = useTodayLimit();
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle>朝昼晩の上限カロリー</CardTitle>
        <AutoSaveIndicator status={status} />
      </CardHeader>
      <CardContent className="space-y-2 px-4">
        <MealSplitBar
          split={split}
          totalCalories={Math.round(limit.calories)}
          onChange={onChange}
        />
        <p className="text-muted-foreground text-xs">
          線を動かして配分を変えます（1日の上限 {Math.round(limit.calories)}
          kcal）。 食べた分はあとの食事に反映されます。
        </p>
      </CardContent>
    </Card>
  );
}

/** 1 食分の提案。最新の提案と、その食事だけの提案し直し・前の提案を表示する。見出しを押すと折り畳める。 */
function SlotSection({
  slot,
  suggestions,
  loading,
  collapsed,
  onToggleCollapsed,
  onGenerate,
}: {
  slot: MealSlot;
  /** この食事枠の今日の提案（新しい順） */
  suggestions: MealSuggestion[];
  loading: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onGenerate: (request: { stores?: NearbyStore[]; avoid?: string[] }) => void;
}) {
  const [pickingStores, setPickingStores] = useState(false);
  const [current, ...previous] = suggestions;

  const generate = (request: { stores?: NearbyStore[]; avoid?: string[] }) => {
    setPickingStores(false);
    if (collapsed) onToggleCollapsed();
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
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            className="group flex w-full items-center gap-1.5 text-left"
            aria-expanded={!collapsed}
            onClick={onToggleCollapsed}
          >
            <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-aria-expanded:rotate-90" />
            <span className="shrink-0 font-semibold">
              {mealSlotLabel(slot)}
            </span>
            {/* 畳んでいる間も何が提案されたか・考え中かが分かるようにする */}
            {collapsed &&
              (loading ? (
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              ) : (
                current && (
                  <span className="text-muted-foreground min-w-0 truncate text-sm">
                    {current.options.map((o) => o.store).join(' / ')}
                  </span>
                )
              ))}
          </button>
        </h2>
        {!collapsed && current && current.stores.length > 0 && (
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
          {current ? '別の案' : '提案'}
        </Button>
      </header>

      {!collapsed && (
        <>
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
                  <summary
                    data-track="過去の提案を開く"
                    className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm"
                  >
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
        </>
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

/** 今日の上限と残り（上限 - 摂取済み）。記録すると即座に反映される。 */
function useTodayLimit() {
  const { logs, settings } = useAppState();
  const [today] = useState(() => formatDate(Date.now()));
  const { limit } = computeDailyLimit(today, settings, logs);
  const remaining = subtractPFC(limit, logs[today]?.total ?? EMPTY_PFC);
  return { limit, remaining };
}

/** 今日の残り。 */
function RemainingLine() {
  const { remaining } = useTodayLimit();
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
