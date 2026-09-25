'use client';

import { useCallback, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Eraser, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { AiEstimatePanel } from '@/components/input/AiEstimatePanel';
import { BarcodeLookupPanel } from '@/components/input/BarcodeLookupPanel';
import { EatDateTimeCard } from '@/components/input/EatDateTimeFields';
import { LabeledInput, PfcMacroInputs } from '@/components/input/FormFields';
import { SimilarFoodSuggestions } from '@/components/input/SimilarFoodSuggestions';
import { useAiNutrition } from '@/hooks/use-ai-nutrition';
import { useBarcodeLookup } from '@/hooks/use-barcode-lookup';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import { useFormDraft } from '@/hooks/use-form-draft';
import { toBarcodeFood, type BarcodeFood } from '@/lib/barcode';
import { addFood, addFoodItem } from '@/lib/client/actions';
import { saveBarcodeMapping } from '@/lib/client/api';
import { useAppState } from '@/lib/client/store';
import {
  EMPTY_FORM_VALUES,
  toFoodInput,
  toFormValues,
  type PfcFormValues,
} from '@/lib/food-form';
import { collectStores } from '@/lib/store-sections';
import { toast } from '@/lib/toast';
import type { FoodItem } from '@/lib/types';

export interface AddFoodFormProps {
  onSuccess?: () => void;
  initialData?: FoodItem;
}

type InputTab = 'manual' | 'photo';

// 入力途中のデータを localStorage に保持するためのキー
const FORM_DRAFT_STORAGE_KEY = 'pfc_add_food_form_draft';

interface AddFoodFormDraft {
  form: PfcFormValues;
  aiInputText: string;
  saveToDictionary: boolean;
  activeTab: InputTab;
}

export function AddFoodForm({ onSuccess, initialData }: AddFoodFormProps) {
  const router = useRouter();
  const { foods, logs } = useAppState();
  const stores = useMemo(() => collectStores(foods, logs), [foods, logs]);
  const [activeTab, setActiveTab] = useState<InputTab>('manual');
  const [saveToDictionary, setSaveToDictionary] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const eatAt = useEatDateTime();

  const { register, handleSubmit, reset, control } = useForm<PfcFormValues>({
    defaultValues: initialData ? toFormValues(initialData) : EMPTY_FORM_VALUES,
  });
  const formValues = useWatch({ control }) as PfcFormValues;

  const applyFood = (food: BarcodeFood) => {
    reset(toFormValues(food));
  };

  const barcode = useBarcodeLookup({
    onFound: applyFood,
    onNotFound: () => {
      reset(EMPTY_FORM_VALUES);
    },
  });

  const ai = useAiNutrition((food) => {
    applyFood(food);
    setActiveTab('manual');
  });
  const { setText: setAiText } = ai;

  // 編集元(initialData)からの呼び出し時は下書きを使わない
  const draft = useMemo<AddFoodFormDraft>(
    () => ({
      form: formValues,
      aiInputText: ai.text,
      saveToDictionary,
      activeTab,
    }),
    [formValues, ai.text, saveToDictionary, activeTab],
  );
  const applyDraft = useCallback(
    (saved: AddFoodFormDraft) => {
      reset(saved.form);
      setAiText(saved.aiInputText);
      setSaveToDictionary(saved.saveToDictionary);
      setActiveTab(saved.activeTab);
    },
    [reset, setAiText],
  );
  const clearDraft = useFormDraft(
    FORM_DRAFT_STORAGE_KEY,
    draft,
    applyDraft,
    !initialData,
  );

  const handleClear = () => {
    reset(EMPTY_FORM_VALUES);
    setSaveToDictionary(false);
    clearDraft();
    toast.success('入力をクリアしました');
  };

  // 各操作は楽観的に即時反映されるため API 応答は待たずに遷移する。
  // 失敗時のロールバックとトーストは actions 側で行う。
  const onSubmit = (values: PfcFormValues) => {
    const item = toFoodInput(values, eatAt.timestamp);
    void addFoodItem(item);
    toast.success(`${item.name}を追加しました`);

    if (saveToDictionary) {
      void addFood({ ...item, id: crypto.randomUUID() }).then((ok) => {
        if (ok) toast.success('食品リストにも保存しました');
      });
    }

    if (barcode.barcode) {
      saveBarcodeMapping([barcode.barcode], toBarcodeFood(item))
        .then(() => toast.success('バーコード情報も保存しました'))
        .catch((error: unknown) =>
          toast.fromError('バーコード情報の保存に失敗しました', error),
        );
    }

    clearDraft();
    if (onSuccess) onSuccess();
    else router.push('/');
  };

  return (
    <div className="space-y-4">
      <EatDateTimeCard value={eatAt.value} onChange={eatAt.onChange} />

      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab as InputTab);
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">手動</TabsTrigger>
          <TabsTrigger value="photo">写真</TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <TabsContent value="manual" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <form
                    onSubmit={(e) => {
                      void handleSubmit(onSubmit)(e);
                    }}
                    className="space-y-4"
                  >
                    <BarcodeLookupPanel
                      barcode={barcode.barcode}
                      mappedFood={barcode.mappedFood}
                      onScan={() => {
                        setShowScanner(true);
                      }}
                      onLookup={(code) => {
                        void barcode.lookup(code, 'manual');
                      }}
                      onClear={barcode.clear}
                    />
                    <div className="space-y-2">
                      <LabeledInput
                        label="食品名"
                        {...register('name', { required: true })}
                        placeholder="例: ランチセット"
                      />
                      <SimilarFoodSuggestions
                        foods={foods}
                        name={formValues.name}
                        onSelect={(food) => {
                          applyFood(food);
                          toast.success(`「${food.name}」を入力しました`);
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
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="saveToDict"
                        checked={saveToDictionary}
                        onCheckedChange={(checked) => {
                          setSaveToDictionary(checked === true);
                        }}
                      />
                      <Label htmlFor="saveToDict" className="text-sm">
                        入力を食品リストにも保存する
                      </Label>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={handleClear}
                      >
                        <Eraser className="h-4 w-4" /> クリア
                      </Button>
                      <Button type="submit" className="flex-1">
                        <Plus className="mr-2 h-4 w-4" /> 記録を追加
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="photo" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <AiEstimatePanel ai={ai} />
                </CardContent>
              </Card>
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>

      {showScanner && (
        <BarcodeScanner
          onScanSuccess={(code) => {
            setShowScanner(false);
            void barcode.lookup(code, 'scan');
          }}
          onClose={() => {
            setShowScanner(false);
          }}
        />
      )}
    </div>
  );
}
