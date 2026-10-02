'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Check,
  CircleAlert,
  Loader2,
  Minus,
  PenLine,
  Plus,
  ScanBarcode,
  X,
} from 'lucide-react';
import { EatDateTimeFields } from '@/components/input/EatDateTimeFields';
import { FoodNameField } from '@/components/input/FoodNameField';
import { LabeledInput, PfcMacroInputs } from '@/components/input/FormFields';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { NutrientTiles } from '@/components/record/ConfirmFood';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { IconButton } from '@/components/ui/icon-button';
import { Label } from '@/components/ui/label';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import type { ScanBatch } from '@/hooks/use-scan-batch';
import { toBarcodeFood } from '@/lib/barcode';
import { useAppState } from '@/lib/client/store';
import {
  EMPTY_FORM_VALUES,
  toFoodInput,
  toFormValues,
  type PfcFormValues,
} from '@/lib/food-form';
import { scalePFC } from '@/lib/pfc';
import {
  batchTotal,
  QUANTITY_STEP,
  readyFoods,
  type BatchItem,
} from '@/lib/scan-batch';
import { collectStores } from '@/lib/store-sections';
import { cn } from '@/lib/utils';

interface BatchReviewProps {
  batch: ScanBatch;
  /** カメラに戻って続けて読み取る */
  onScanMore: () => void;
  onDone: () => void;
}

/** まとめて読み取った商品を確認・修正し、一括で記録（または食品リストに登録）する。 */
export function BatchReview({ batch, onScanMore, onDone }: BatchReviewProps) {
  const { foods, logs } = useAppState();
  const stores = useMemo(() => collectStores(foods, logs), [foods, logs]);
  const eatAt = useEatDateTime();
  const [editingId, setEditingId] = useState<string | null>(null);
  const { items, record } = batch;

  const readyCount = readyFoods(items).length;
  const pendingCount = items.filter((item) => item.status !== 'ready').length;
  const total = batchTotal(items);

  if (items.length === 0) {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="text-muted-foreground text-sm">
          商品がありません。バーコードを読み取ってください。
        </p>
        <ScanMoreButton onScanMore={onScanMore} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {record && <NutrientTiles pfc={total} />}

      <ul className="space-y-2">
        {items.map((item) =>
          editingId === item.id ? (
            <li key={item.id}>
              <ItemEditor
                item={item}
                stores={stores}
                onSave={(values) => {
                  batch.setFood(item.id, toBarcodeFood(toFoodInput(values, 0)));
                  setEditingId(null);
                }}
                onCancel={() => {
                  setEditingId(null);
                }}
              />
            </li>
          ) : (
            <ItemCard
              key={item.id}
              item={item}
              showQuantity={record}
              onEdit={() => {
                setEditingId(item.id);
              }}
              onQuantityChange={(quantity) => {
                batch.setQuantity(item.id, quantity);
              }}
              onRemove={() => {
                batch.remove(item.id);
              }}
            />
          ),
        )}
      </ul>

      <ScanMoreButton onScanMore={onScanMore} />

      <div className="bg-muted/50 space-y-3 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="batch-record"
            checked={record}
            onCheckedChange={(checked) => {
              batch.setRecord(checked === true);
            }}
          />
          <Label htmlFor="batch-record" className="flex-1">
            食べた記録にも追加する
          </Label>
        </div>
        {record ? (
          <EatDateTimeFields value={eatAt.value} onChange={eatAt.onChange} />
        ) : (
          <p className="text-muted-foreground text-xs">
            食品リストへの登録とバーコードの紐付けだけを行います。
          </p>
        )}
      </div>

      {/* 修正中は記録できず、入力欄とキーボードの間に挟まって邪魔になるので画面下に固定しない */}
      <div
        className={cn(
          'bg-background -mx-4 space-y-1.5 border-t px-4 pt-3 pb-1',
          editingId === null && 'sticky bottom-0',
        )}
      >
        {pendingCount > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <CircleAlert className="size-3.5" />
            栄養が未入力・読み取り中の{pendingCount}
            品は保存されません
          </p>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="h-12"
            onClick={() => {
              if (confirm('一覧を空にしますか？')) batch.clear();
            }}
          >
            クリア
          </Button>
          <Button
            size="lg"
            className="h-12 flex-1 text-base"
            disabled={readyCount === 0 || editingId !== null}
            onClick={() => {
              batch.commit(eatAt.timestamp);
              onDone();
            }}
          >
            <Check />
            {record
              ? `${readyCount}品を記録`
              : `${readyCount}品を食品リストに登録`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScanMoreButton({ onScanMore }: { onScanMore: () => void }) {
  return (
    <Button variant="outline" className="w-full" onClick={onScanMore}>
      <ScanBarcode /> 続けてスキャン
    </Button>
  );
}

function ItemCard({
  item,
  showQuantity,
  onEdit,
  onQuantityChange,
  onRemove,
}: {
  item: BatchItem;
  showQuantity: boolean;
  onEdit: () => void;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const removeButton = (
    <IconButton
      className="text-muted-foreground"
      aria-label={`${item.food?.name ?? 'この商品'}を外す`}
      data-track="スキャンした商品を外す"
      onClick={onRemove}
    >
      <X />
    </IconButton>
  );

  if (item.status === 'loading') {
    return (
      <li className="flex items-center gap-3 rounded-lg border border-dashed p-3">
        <Loader2 className="text-muted-foreground size-5 animate-spin" />
        <div className="min-w-0 flex-1">
          <p className="text-sm">{item.loadingLabel}...</p>
          <BarcodeLabel barcode={item.barcode} />
        </div>
      </li>
    );
  }

  if (item.status === 'missing') {
    return (
      <li className="space-y-2 rounded-lg border border-amber-400/60 bg-amber-50 p-3 dark:bg-amber-950/30">
        <div className="flex items-start gap-2">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">未登録の商品</p>
            <BarcodeLabel barcode={item.barcode} />
          </div>
          {removeButton}
        </div>
        <Button size="sm" className="w-full" onClick={onEdit}>
          <PenLine /> 栄養値を入力
        </Button>
      </li>
    );
  }

  const food = item.food;
  if (!food) return null;
  return (
    <li className="flex items-center gap-1 rounded-lg border py-2 pl-3">
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onEdit}
        aria-label={`${food.name}を修正`}
        data-track="スキャンした商品を修正"
      >
        {food.store && (
          <p className="text-muted-foreground truncate text-[11px]">
            {food.store}
          </p>
        )}
        <p className="flex items-center gap-1 text-sm leading-snug font-medium">
          <span className="line-clamp-2">{food.name}</span>
          <PenLine className="text-muted-foreground size-3 shrink-0" />
        </p>
        <PfcMacroLine
          food={showQuantity ? scalePFC(food, item.quantity) : food}
          precision={0}
          className="mt-0.5"
        />
      </button>
      {showQuantity && (
        <QuantityStepper value={item.quantity} onChange={onQuantityChange} />
      )}
      {removeButton}
    </li>
  );
}

function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center rounded-full border">
      <IconButton
        size="icon-sm"
        className="rounded-full"
        aria-label="数量を減らす"
        disabled={value <= QUANTITY_STEP}
        onClick={() => {
          onChange(value - QUANTITY_STEP);
        }}
      >
        <Minus />
      </IconButton>
      <span className="w-8 text-center text-sm font-semibold tabular-nums">
        ×{value}
      </span>
      <IconButton
        size="icon-sm"
        className="rounded-full"
        aria-label="数量を増やす"
        onClick={() => {
          onChange(value + QUANTITY_STEP);
        }}
      >
        <Plus />
      </IconButton>
    </div>
  );
}

function BarcodeLabel({ barcode }: { barcode: string }) {
  return (
    <p className="text-muted-foreground flex items-center gap-1 font-mono text-xs">
      <ScanBarcode className="size-3" /> {barcode}
    </p>
  );
}

/** 一覧の中でそのまま栄養値を入力・修正する。 */
function ItemEditor({
  item,
  stores,
  onSave,
  onCancel,
}: {
  item: BatchItem;
  stores: string[];
  onSave: (values: PfcFormValues) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, reset, control } = useForm<PfcFormValues>({
    defaultValues: item.food ? toFormValues(item.food) : EMPTY_FORM_VALUES,
  });

  return (
    <form
      className="border-primary space-y-3 rounded-lg border-2 p-3"
      onSubmit={(e) => {
        void handleSubmit(onSave)(e);
      }}
    >
      <BarcodeLabel barcode={item.barcode} />
      <FoodNameField
        register={register}
        control={control}
        onSelect={(food) => {
          reset(toFormValues(food));
        }}
      />
      <PfcMacroInputs register={register} />
      <LabeledInput
        label="店名 / ブランド (任意)"
        {...register('store')}
        options={stores}
        placeholder="例: セブンイレブン"
      />
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          キャンセル
        </Button>
        <Button type="submit" className="flex-1">
          <Check /> 決定
        </Button>
      </div>
    </form>
  );
}
