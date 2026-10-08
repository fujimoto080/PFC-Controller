'use client';

import { useRef, useState } from 'react';
import {
  Camera,
  Check,
  CircleAlert,
  Loader2,
  Minus,
  PenLine,
  Plus,
  ScanBarcode,
  X,
} from 'lucide-react';
import { AiReadingLog } from '@/components/input/AiReadingLog';
import { EatDateTimeFields } from '@/components/input/EatDateTimeFields';
import { ImageFileInput } from '@/components/input/ImageFileInput';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { NutrientTiles } from '@/components/pfc/NutrientTiles';
import { FoodForm } from '@/components/input/FoodForm';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { IconButton } from '@/components/ui/icon-button';
import { Label } from '@/components/ui/label';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import type { ScanBatch } from '@/hooks/use-scan-batch';
import { imageToDataUrl } from '@/lib/client/image';
import { scalePFC } from '@/lib/pfc';
import {
  batchTotal,
  QUANTITY_STEP,
  readyFoods,
  type BatchItem,
} from '@/lib/scan-batch';
import { toJstTimestamp } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface BatchReviewProps {
  batch: ScanBatch;
  /** カメラに戻って続けて読み取る */
  onScanMore: () => void;
  onDone: () => void;
}

/** まとめて読み取った商品を確認・修正し、一括で記録（または食品リストに登録）する。 */
export function BatchReview({ batch, onScanMore, onDone }: BatchReviewProps) {
  const eatAt = useEatDateTime();
  const [editingId, setEditingId] = useState<string | null>(null);
  // 成分表示は端末のカメラで撮る。撮った写真をどの商品に使い、前の写真に足すかを覚えておく
  const photoTargetRef = useRef<{ id: string; append: boolean } | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const takePhoto = (id: string, append: boolean) => {
    photoTargetRef.current = { id, append };
    cameraRef.current?.click();
  };
  const fillFromPhoto = async ([file]: File[]) => {
    const target = photoTargetRef.current;
    if (!file || !target) return;
    try {
      void batch.fillFromPhoto(
        target.id,
        await imageToDataUrl(file),
        target.append,
      );
    } catch (error) {
      toast.fromError('画像の読み込みに失敗しました', error);
    }
  };
  const { items, record } = batch;

  const readyCount = readyFoods(items).length;
  const pendingCount = items.filter((item) => item.status !== 'ready').length;
  const total = batchTotal(items, record);
  const hasRecords = readyFoods(items).some(
    ({ item }) => item.record ?? record,
  );
  const editingItem = items.find((item) => item.id === editingId);

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

  if (editingItem) {
    return (
      <FoodForm
        key={editingItem.id}
        draftKey={`batch:${editingItem.id}`}
        initial={editingItem.food}
        photos={editingItem.photos}
        initialTimestamp={editingItem.timestamp ?? eatAt.timestamp}
        initialBarcodes={
          editingItem.barcodes ??
          (editingItem.barcode ? [editingItem.barcode] : [])
        }
        initialQuantity={editingItem.quantity}
        defaultSaveFood={editingItem.saveFood ?? true}
        defaultRecord={editingItem.record ?? record}
        onSave={(entry) => {
          batch.setRegistration(editingItem.id, entry);
        }}
        onDone={() => {
          setEditingId(null);
        }}
        onCancel={() => {
          setEditingId(null);
        }}
      />
    );
  }

  return (
    <fieldset disabled={batch.saving} className="min-w-0 space-y-4">
      {hasRecords && <NutrientTiles pfc={total} />}

      <ul className="space-y-2">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            showQuantity={item.record ?? record}
            onEdit={() => {
              setEditingId(item.id);
            }}
            onTakePhoto={() => {
              takePhoto(item.id, false);
            }}
            onQuantityChange={(quantity) => {
              batch.setQuantity(item.id, quantity);
            }}
            onRemove={() => {
              batch.remove(item.id);
            }}
          />
        ))}
      </ul>

      <ScanMoreButton onScanMore={onScanMore} />
      <AiReadingLog />
      <ImageFileInput
        ref={cameraRef}
        capture
        onSelect={(files) => {
          void fillFromPhoto(files);
        }}
      />

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
            全商品を食べた記録にも追加する
          </Label>
        </div>
        {hasRecords ? (
          <EatDateTimeFields
            value={eatAt.value}
            onChange={(value) => {
              eatAt.onChange(value);
              batch.setTimestamp(toJstTimestamp(value.date, value.time));
            }}
          />
        ) : (
          <p className="text-muted-foreground text-xs">
            商品を開くと保存先や数量、日時を個別に指定できます。
          </p>
        )}
      </div>

      {/* 編集時は共通フォームに切り替え、一覧では保存ボタンを下に固定する */}
      <div className="bg-background sticky bottom-0 -mx-4 space-y-1.5 border-t px-4 pt-3 pb-1">
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
            disabled={batch.saving || readyCount === 0 || editingId !== null}
            onClick={() => {
              void batch.commit(eatAt.timestamp).then((saved) => {
                if (saved) onDone();
              });
            }}
          >
            <Check />
            {batch.saving ? '保存中…' : `${readyCount}品を保存`}
          </Button>
        </div>
      </div>
    </fieldset>
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
  onTakePhoto,
  onQuantityChange,
  onRemove,
}: {
  item: BatchItem;
  showQuantity: boolean;
  onEdit: () => void;
  onTakePhoto: () => void;
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
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" onClick={onTakePhoto}>
            <Camera /> 成分表示を撮影
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <PenLine /> 手で入力
          </Button>
        </div>
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
  if (!barcode) return null;
  return (
    <p className="text-muted-foreground flex items-center gap-1 font-mono text-xs">
      <ScanBarcode className="size-3" /> {barcode}
    </p>
  );
}
