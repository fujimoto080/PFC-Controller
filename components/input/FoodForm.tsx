'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Eraser, Save, ScanBarcode, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EatDateTimeFields } from '@/components/input/EatDateTimeFields';
import { EstimationPhotos } from '@/components/input/EstimationPhotos';
import { FoodNameField } from '@/components/input/FoodNameField';
import { LabeledInput, PfcMacroInputs } from '@/components/input/FormFields';
import { NutritionPhotoButton } from '@/components/input/NutritionPhotoButton';
import { StoreField } from '@/components/input/StoreField';
import { useAiNutrition } from '@/hooks/use-ai-nutrition';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import { useFormDraft } from '@/hooks/use-form-draft';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { normalizeBarcodes } from '@/lib/barcode';
import { fetchBarcodeFood } from '@/lib/client/api';
import {
  saveFoodRegistration,
  type FoodRegistration,
} from '@/lib/client/food-registration';
import { useAppState } from '@/lib/client/store';
import {
  EMPTY_FORM_VALUES,
  toFoodInput,
  toFormValues,
  type FoodTemplate,
  type PfcFormValues,
} from '@/lib/food-form';
import { collectStoreGroups, collectStores } from '@/lib/store-sections';
import { toast } from '@/lib/toast';
import { QuantitySelector } from '@/components/record/QuantitySelector';

// 入力途中のデータを localStorage に保持するためのキー
const FORM_DRAFT_STORAGE_KEY = 'pfc_add_food_form_draft';

interface FoodFormDraft {
  form: PfcFormValues;
  aiInputText: string;
  quantity: number;
  barcodes: string;
  saveFood: boolean;
  record: boolean;
  eatAt: { date: string; time: string };
}

interface FoodFormProps {
  /** 入力済みにしておく食品。未指定なら空欄から入力する。 */
  initial?: FoodTemplate;
  /** AI が読み取った元の写真。入力済みの数値と見比べられるよう上に出す。 */
  photos?: string[];
  initialTimestamp: number;
  /** 追加・更新するバーコード。保存先に関わらず1個分の栄養値を紐付ける。 */
  initialBarcodes?: string[];
  initialQuantity?: number;
  defaultSaveFood?: boolean;
  defaultRecord?: boolean;
  foodId?: string;
  logId?: string;
  draftKey?: string;
  onSave?: (entry: FoodRegistration) => void;
  onBarcodesSaved?: (food: FoodTemplate, barcodes: string[]) => void;
  onCancel?: () => void;
  onDone: () => void;
}

/**
 * 全入口で使う食品の登録・編集フォーム。写真と文章からの AI 入力、商品名・バーコード検索、保存先指定をまとめる。
 * 入力途中の内容は対象ごとの下書きに保持し、一括登録では一覧への反映まで行う。
 */
export function FoodForm({
  initial,
  photos: initialPhotos,
  initialTimestamp,
  initialBarcodes = [],
  initialQuantity = 1,
  defaultSaveFood = true,
  defaultRecord = true,
  foodId,
  logId,
  draftKey,
  onSave,
  onBarcodesSaved,
  onCancel,
  onDone,
}: FoodFormProps) {
  const { foods, logs } = useAppState();
  const stores = useMemo(() => collectStores(foods, logs), [foods, logs]);
  const groups = useMemo(() => collectStoreGroups(foods), [foods]);
  const [barcodes, setBarcodes] = useState(initialBarcodes.join(', '));
  const [scannerOpen, setScannerOpen] = useState(false);
  const [saveFood, setSaveFood] = useState(defaultSaveFood);
  const [record, setRecord] = useState(defaultRecord);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const eatAt = useEatDateTime(initialTimestamp);
  const { onChange: setEatAt } = eatAt;

  const { register, handleSubmit, reset, control, setValue, getValues } =
    useForm<PfcFormValues>({
      defaultValues: initial ? toFormValues(initial) : EMPTY_FORM_VALUES,
    });
  const formValues = useWatch({ control }) as PfcFormValues;

  const [photos, setPhotos] = useState(initialPhotos);
  const [factor, setFactor] = useState(initialQuantity);

  const applyFood = (food: FoodTemplate, estimatedPhotos?: string[]) => {
    const current = getValues();
    reset({
      ...toFormValues(food),
      store: food.store ?? current.store,
      storeGroup: food.storeGroup ?? current.storeGroup,
    });
    if (estimatedPhotos) setPhotos(estimatedPhotos);
  };
  const ai = useAiNutrition(applyFood);
  const { setText: setAiText } = ai;

  const draft = useMemo<FoodFormDraft>(
    () => ({
      form: formValues,
      aiInputText: ai.text,
      quantity: factor,
      barcodes,
      saveFood,
      record,
      eatAt: eatAt.value,
    }),
    [formValues, ai.text, factor, barcodes, saveFood, record, eatAt.value],
  );
  const applyDraft = useCallback(
    (saved: FoodFormDraft) => {
      reset(saved.form);
      setAiText(saved.aiInputText);
      setFactor(saved.quantity);
      setBarcodes(saved.barcodes);
      setSaveFood(saved.saveFood);
      setRecord(saved.record);
      setEatAt(saved.eatAt);
    },
    [reset, setAiText, setEatAt],
  );
  const clearDraft = useFormDraft(
    `${FORM_DRAFT_STORAGE_KEY}:v2:${draftKey ?? foodId ?? logId ?? initial?.name ?? (defaultRecord ? 'new-record' : 'new-food')}`,
    draft,
    applyDraft,
    true,
  );

  const handleClear = () => {
    reset(EMPTY_FORM_VALUES);
    setFactor(1);
    setAiText('');
    setBarcodes('');
    setPhotos(undefined);
    setPhotoVersion((version) => version + 1);
    setSaveFood(defaultSaveFood);
    setRecord(defaultRecord);
    clearDraft();
  };

  const onSubmit = async (values: PfcFormValues) => {
    if (savingRef.current || lookingUp || ai.pending !== null) return;
    if (!Number.isFinite(eatAt.timestamp)) {
      toast.info('日付と時刻を入力してください');
      return;
    }
    if (!saveFood && !record && normalizeBarcodes(barcodes).length === 0) {
      toast.info('保存先を選んでください');
      return;
    }
    const entry: FoodRegistration = {
      food: toFoodInput(values, eatAt.timestamp),
      quantity: factor,
      barcodes: normalizeBarcodes(barcodes),
      saveFood,
      record,
      photos,
    };
    if (onSave) {
      onSave(entry);
    } else {
      savingRef.current = true;
      setSaving(true);
      const saved = await saveFoodRegistration(entry, { foodId, logId });
      setSaving(false);
      savingRef.current = false;
      if (!saved) return;
      if (entry.barcodes.length > 0)
        onBarcodesSaved?.(entry.food, entry.barcodes);
      toast.success('保存しました');
    }
    clearDraft();
    onDone();
  };

  const lookupBarcode = async () => {
    const barcode = normalizeBarcodes(barcodes).at(-1);
    if (!barcode || lookingUp) return;
    setLookingUp(true);
    try {
      const food = await fetchBarcodeFood(barcode);
      if (food) applyFood(food);
      else toast.info('未登録の商品です。写真や商品名から入力できます');
    } catch (error) {
      toast.fromError('バーコードの照会に失敗しました', error);
    } finally {
      setLookingUp(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(onSubmit)(e);
      }}
      className="space-y-4"
    >
      <fieldset disabled={saving} className="min-w-0 space-y-4">
        <EstimationPhotos photos={photos} />
        <AiAssist
          key={photoVersion}
          ai={ai}
          initialPhotos={photoVersion === 0 ? initialPhotos : undefined}
        />

        <FoodNameField
          register={register}
          control={control}
          onSelect={applyFood}
        />
        <PfcMacroInputs register={register} />
        <QuantitySelector value={factor} onChange={setFactor} />
        <p className="text-muted-foreground text-xs">
          栄養値は1個分。数量は食事記録にだけ反映します。
        </p>
        <StoreField
          register={register}
          control={control}
          setValue={setValue}
          options={stores}
        />
        <LabeledInput
          label="店内グループ (任意)"
          {...register('storeGroup')}
          options={groups}
          placeholder="例: おにぎり"
        />
        <div className="space-y-2">
          <LabeledInput
            label="バーコード (任意・複数可)"
            value={barcodes}
            onChange={(event) => {
              setBarcodes(event.target.value);
            }}
            placeholder="カンマ・空白区切りで入力"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setScannerOpen(true);
            }}
          >
            <ScanBarcode /> バーコードを追加
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={
              lookingUp ||
              saving ||
              ai.pending !== null ||
              normalizeBarcodes(barcodes).length === 0
            }
            onClick={() => {
              void lookupBarcode();
            }}
          >
            {lookingUp ? '商品を照会中…' : '最後のバーコードから商品を検索'}
          </Button>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Checkbox
              checked={saveFood}
              onCheckedChange={(checked) => {
                setSaveFood(checked === true);
              }}
            />
            {foodId ? '食品リストを更新する' : '食品リストに登録する'}
          </Label>
          <Label className="flex items-center gap-2">
            <Checkbox
              checked={record}
              onCheckedChange={(checked) => {
                setRecord(checked === true);
              }}
            />
            {logId ? '食事記録を更新する' : '食べた記録にも追加する'}
          </Label>
        </div>
        <EatDateTimeFields value={eatAt.value} onChange={eatAt.onChange} />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleClear}
            aria-label="入力をクリア"
          >
            <Eraser />
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              キャンセル
            </Button>
          )}
          <Button
            type="submit"
            size="lg"
            className="flex-1"
            disabled={saving || lookingUp || ai.pending !== null}
          >
            <Save /> {saving ? '保存中…' : onSave ? '決定' : '保存'}
          </Button>
        </div>
      </fieldset>
      {scannerOpen && (
        <BarcodeScanner
          onScanSuccess={(code) => {
            setBarcodes((current) =>
              normalizeBarcodes(`${current}, ${code}`).join(', '),
            );
            setScannerOpen(false);
          }}
          onClose={() => {
            setScannerOpen(false);
          }}
        />
      )}
    </form>
  );
}

/** 栄養成分表示や料理の写真、または文章から AI で栄養値を入力する。 */
function AiAssist({
  ai,
  initialPhotos,
}: {
  ai: ReturnType<typeof useAiNutrition>;
  initialPhotos?: string[];
}) {
  const busy = ai.pending !== null;

  return (
    <div className="bg-muted/50 space-y-2 rounded-lg p-3">
      <NutritionPhotoButton
        initialPhotos={initialPhotos}
        onRead={ai.estimateFromImages}
        disabled={busy}
        reading={ai.pending === 'image'}
      />
      <div className="flex gap-2">
        <Input
          value={ai.text}
          onChange={(event) => {
            ai.setText(event.target.value);
          }}
          placeholder="文章で推定: おにぎり2個とサラダ"
          aria-label="AI 推定する内容"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void ai.estimate();
          }}
          disabled={busy}
          aria-label="AI で推定"
        >
          <Sparkles />
        </Button>
      </div>
      {ai.pending === 'text' && (
        <p className="text-muted-foreground text-xs">AIで推定中...</p>
      )}
    </div>
  );
}
