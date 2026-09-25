'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Camera, Eraser, Plus, ScanBarcode, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EatDateTimeFields } from '@/components/input/EatDateTimeFields';
import { LabeledInput, PfcMacroInputs } from '@/components/input/FormFields';
import { SimilarFoodSuggestions } from '@/components/input/SimilarFoodSuggestions';
import { useAiNutrition } from '@/hooks/use-ai-nutrition';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import { useFormDraft } from '@/hooks/use-form-draft';
import { buildFoodMatchKey, toBarcodeFood } from '@/lib/barcode';
import { addFood, addFoodItem } from '@/lib/client/actions';
import { saveBarcodeMapping } from '@/lib/client/api';
import { useAppState } from '@/lib/client/store';
import {
  EMPTY_FORM_VALUES,
  toFoodInput,
  toFormValues,
  type FoodTemplate,
  type PfcFormValues,
} from '@/lib/food-form';
import { collectStores } from '@/lib/store-sections';
import { toast } from '@/lib/toast';

// 入力途中のデータを localStorage に保持するためのキー
const FORM_DRAFT_STORAGE_KEY = 'pfc_add_food_form_draft';

interface FoodLogFormDraft {
  form: PfcFormValues;
  aiInputText: string;
}

interface FoodLogFormProps {
  /** 入力済みにしておく食品。未指定なら空欄から入力する。 */
  initial?: FoodTemplate;
  initialTimestamp: number;
  /** 読み取ったバーコード。指定すると記録時にマッピングも保存する。 */
  barcode?: string;
  onDone: () => void;
}

/**
 * 栄養値を入力して食事を記録するフォーム。写真(OCR)・テキストからの AI 推定で入力を補助する。
 * 空欄からの入力時だけ、写真撮影で画面が破棄されても消えないよう下書きを保持する。
 */
export function FoodLogForm({
  initial,
  initialTimestamp,
  barcode,
  onDone,
}: FoodLogFormProps) {
  const { foods, logs } = useAppState();
  const stores = useMemo(() => collectStores(foods, logs), [foods, logs]);
  const isBlank = initial === undefined && barcode === undefined;
  const eatAt = useEatDateTime(initialTimestamp);

  const { register, handleSubmit, reset, control } = useForm<PfcFormValues>({
    defaultValues: initial ? toFormValues(initial) : EMPTY_FORM_VALUES,
  });
  const formValues = useWatch({ control }) as PfcFormValues;

  const applyFood = (food: FoodTemplate) => {
    reset(toFormValues(food));
  };
  const ai = useAiNutrition(applyFood);
  const { setText: setAiText } = ai;

  const draft = useMemo<FoodLogFormDraft>(
    () => ({ form: formValues, aiInputText: ai.text }),
    [formValues, ai.text],
  );
  const applyDraft = useCallback(
    (saved: FoodLogFormDraft) => {
      reset(saved.form);
      setAiText(saved.aiInputText);
    },
    [reset, setAiText],
  );
  const clearDraft = useFormDraft(
    FORM_DRAFT_STORAGE_KEY,
    draft,
    applyDraft,
    isBlank,
  );

  const handleClear = () => {
    reset(EMPTY_FORM_VALUES);
    setAiText('');
    clearDraft();
  };

  // 各操作は楽観的に即時反映されるため API 応答は待たずに閉じる。
  // 失敗時のロールバックとトーストは actions 側で行う。
  const onSubmit = (values: PfcFormValues) => {
    const item = toFoodInput(values, eatAt.timestamp);
    void addFoodItem(item);
    toast.success(`${item.name}を記録しました`);

    // 同じ内容の食品が既にあれば食品リストへは追加しない
    const matchKey = buildFoodMatchKey(item);
    if (!foods.some((food) => buildFoodMatchKey(food) === matchKey)) {
      void addFood({ ...item, id: crypto.randomUUID() }).then((ok) => {
        if (ok) toast.success('食品リストにも保存しました');
      });
    }

    if (barcode) {
      saveBarcodeMapping([barcode], toBarcodeFood(item))
        .then(() => toast.success('バーコード情報も保存しました'))
        .catch((error: unknown) =>
          toast.fromError('バーコード情報の保存に失敗しました', error),
        );
    }

    clearDraft();
    onDone();
  };

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(onSubmit)(e);
      }}
      className="space-y-4"
    >
      {barcode && (
        <p className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs">
          <ScanBarcode className="h-3.5 w-3.5" /> {barcode}
        </p>
      )}

      <AiAssist ai={ai} />

      <div className="space-y-2">
        <LabeledInput
          label="食品名"
          {...register('name', { required: true })}
          placeholder="例: サラダチキン"
        />
        <SimilarFoodSuggestions
          foods={foods}
          name={formValues.name}
          onSelect={(food) => {
            applyFood(food);
          }}
        />
      </div>
      <PfcMacroInputs register={register} />
      <LabeledInput
        label="店名 / ブランド (任意)"
        {...register('store')}
        options={stores}
        placeholder="例: セブンイレブン"
      />
      <EatDateTimeFields value={eatAt.value} onChange={eatAt.onChange} />
      <div className="flex gap-2">
        {isBlank && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleClear}
            aria-label="入力をクリア"
          >
            <Eraser />
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1">
          <Plus /> 記録する
        </Button>
      </div>
    </form>
  );
}

/** 栄養成分表示や料理の写真、または文章から AI で栄養値を入力する。 */
function AiAssist({ ai }: { ai: ReturnType<typeof useAiNutrition> }) {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const busy = ai.isExtracting || ai.isEstimating;

  return (
    <div className="bg-muted/50 space-y-2 rounded-lg p-3">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => photoInputRef.current?.click()}
        disabled={busy}
      >
        <Camera /> 成分表示・料理を撮影して自動入力
      </Button>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onClick={(event) => {
          event.currentTarget.value = '';
        }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void ai.extractFromImage(file);
        }}
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
      {busy && (
        <p className="text-muted-foreground text-xs">
          {ai.isExtracting ? '画像から文字を抽出中...' : 'AIで推定中...'}
        </p>
      )}
    </div>
  );
}
