'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Camera, Loader2, Plus, ScanBarcode } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { addFoodItem } from '@/lib/storage/logs';
import { addFoodToDictionary } from '@/lib/storage/foods';
import { FoodItem } from '@/lib/types';
import { toFoodInput } from '@/lib/pfc';
import { PfcMacroInputs, DatalistInput } from '@/components/input/PfcFieldsGroup';
import { EatDateTimeCard } from '@/components/input/EatDateTimeFields';
import { generateId } from '@/lib/utils';
import { useFoodDictionary } from '@/hooks/use-food-dictionary';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import { useBarcodeLookup } from '@/hooks/use-barcode-lookup';
import { useAiNutrition } from '@/hooks/use-ai-nutrition';
import { clearFormDraft, useFormDraft } from '@/hooks/use-form-draft';
import { toast } from '@/lib/toast';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { getSimilarFoodSuggestions } from '@/lib/food-suggestions';
import { saveBarcodeMappingRequest } from '@/lib/barcode-client';
import type { BarcodeFood } from '@/lib/barcode-mapping';

export interface AddFoodFormProps {
  onSuccess?: () => void;
  initialData?: FoodItem;
}

interface ManualFoodFormValues {
  name: string;
  protein?: number;
  fat?: number;
  carbs?: number;
  calories?: number;
  store?: string;
}

// 入力途中のデータを localStorage に保持するためのキー
const FORM_DRAFT_STORAGE_KEY = 'pfc_add_food_form_draft';

interface AddFoodFormDraft {
  form: ManualFoodFormValues;
  aiInputText: string;
  saveToDictionary: boolean;
  activeTab: string;
}

export function AddFoodForm({ onSuccess, initialData }: AddFoodFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('manual');
  const { foods, uniqueStores } = useFoodDictionary();
  const [saveToDictionary, setSaveToDictionary] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const { eatDate, setEatDate, eatTime, setEatTime, getSelectedTimestamp } =
    useEatDateTime();

  // Form for manual entry
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<ManualFoodFormValues>({
      defaultValues: initialData
        ? {
            name: initialData.name,
            protein: initialData.protein,
            fat: initialData.fat,
            carbs: initialData.carbs,
            calories: initialData.calories,
            store: initialData.store,
          }
        : undefined,
    });
  const watchedValues = watch();
  const watchedName = watchedValues.name ?? '';
  const similarFoods = useMemo(
    () => getSimilarFoodSuggestions(foods, watchedName),
    [foods, watchedName],
  );

  const applyFoodDataToForm = (data: BarcodeFood) => {
    reset({
      name: data.name,
      protein: data.protein,
      fat: data.fat,
      carbs: data.carbs,
      calories: data.calories,
      store: data.store,
    });

    const values = getValues();
    const isNameValid =
      typeof values.name === 'string' && values.name.trim().length > 0;
    const areMacrosValid =
      Number.isFinite(values.protein) &&
      Number.isFinite(values.fat) &&
      Number.isFinite(values.carbs) &&
      Number.isFinite(values.calories);

    return isNameValid && areMacrosValid;
  };

  const clearForm = () =>
    reset({
      name: '',
      protein: undefined,
      fat: undefined,
      carbs: undefined,
      calories: undefined,
      store: '',
    });

  const {
    scannedBarcode,
    setScannedBarcode,
    barcodeLookupInput,
    setBarcodeLookupInput,
    mappedFoodData,
    setMappedFoodData,
    runLookup,
    clear: clearBarcode,
  } = useBarcodeLookup({ applyFoodData: applyFoodDataToForm, clearForm });

  const {
    aiInputText,
    setAiInputText,
    isEstimatingNutrition,
    isExtractingText,
    handleEstimateByAi,
    handleExtractTextFromImage,
  } = useAiNutrition({
    applyFoodData: applyFoodDataToForm,
    onApplied: () => setActiveTab('manual'),
  });

  // 編集モード (initialData 指定) では下書き機能は無効。新規追加時のみ有効化する
  const isDraftEnabled = !initialData;
  const draftValue = useMemo<AddFoodFormDraft>(
    () => ({
      form: watchedValues,
      aiInputText,
      saveToDictionary,
      activeTab,
    }),
    [watchedValues, aiInputText, saveToDictionary, activeTab],
  );
  const applyDraft = useCallback(
    (draft: AddFoodFormDraft) => {
      if (draft.form) {
        reset(draft.form);
      }
      if (typeof draft.aiInputText === 'string') {
        setAiInputText(draft.aiInputText);
      }
      if (typeof draft.saveToDictionary === 'boolean') {
        setSaveToDictionary(draft.saveToDictionary);
      }
      if (typeof draft.activeTab === 'string') {
        setActiveTab(draft.activeTab);
      }
    },
    [reset, setAiInputText],
  );
  useFormDraft(FORM_DRAFT_STORAGE_KEY, draftValue, applyDraft, {
    enabled: isDraftEnabled,
  });

  const onSubmitManual = async (data: ManualFoodFormValues) => {
    const item = toFoodInput(data, getSelectedTimestamp());

    try {
      await addFoodItem(item);
    } catch {
      // addFoodItem 側でエラートーストを表示済み。追加処理は中断する
      return;
    }
    if (saveToDictionary) {
      try {
        await addFoodToDictionary({ ...item, id: generateId() });
        toast.success('食品リストにも保存しました');
      } catch {
        // addFoodToDictionary 側でエラートーストを表示済み。
        // 食事記録(addFoodItem)は保存済みなので処理は継続する。
      }
    }
    toast.success(item.name + 'を追加しました');

    if (scannedBarcode) {
      try {
        await saveBarcodeMappingRequest([scannedBarcode], {
          name: item.name,
          protein: item.protein,
          fat: item.fat,
          carbs: item.carbs,
          calories: item.calories,
          store: item.store,
        });
        toast.success('バーコード情報も保存しました');
      } catch (error) {
        toast.fromError('バーコード情報の保存に失敗しました', error);
      } finally {
        clearBarcode();
      }
    }

    reset();
    setSaveToDictionary(false);
    setAiInputText('');
    clearFormDraft(FORM_DRAFT_STORAGE_KEY);
    if (onSuccess) {
      onSuccess();
    } else {
      router.push('/');
    }
  };

  const handleApplySuggestion = (food: FoodItem) => {
    setValue('name', food.name, { shouldDirty: true });
    setValue('protein', food.protein, { shouldDirty: true });
    setValue('fat', food.fat, { shouldDirty: true });
    setValue('carbs', food.carbs, { shouldDirty: true });
    setValue('calories', food.calories, { shouldDirty: true });
    setValue('store', food.store ?? '', { shouldDirty: true });
    toast.success(`「${food.name}」を入力しました`);
  };

  const handleScanSuccess = async (code: string) => {
    setShowScanner(false);
    setScannedBarcode(code); // バーコードを保存
    const loadingToast = toast.loading('商品情報を取得中...');

    try {
      const data = await runLookup(code);
      toast.dismiss(loadingToast);
      setActiveTab('manual');

      if (data) {
        toast.success(`「${data.name}」が見つかりました (${code})`);
      } else {
        toast.dismiss(loadingToast);
        toast.info(
          'バーコードが見つかりませんでした。手動で入力してください。',
        );
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.fromError('バーコード読み取りエラー', error, 'エラーが発生しました');
    }
  };

  const handleLookupBarcode = async () => {
    const code = barcodeLookupInput.trim();

    if (!code) {
      toast.info('確認したいバーコードを入力してください');
      return;
    }

    const loadingToast = toast.loading('バーコードのマッピングを確認中...');
    setScannedBarcode(code);

    try {
      const data = await runLookup(code);
      toast.dismiss(loadingToast);
      setActiveTab('manual');

      if (data) {
        toast.success(`「${data.name}」のマッピングを表示しています`);
      } else {
        toast.info('このバーコードは未登録です。手動入力で登録できます。');
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.fromError('バーコード照会エラー', error, 'エラーが発生しました');
    }
  };

  return (
    <div className="space-y-4">
      <EatDateTimeCard
        eatDate={eatDate}
        setEatDate={setEatDate}
        eatTime={eatTime}
        setEatTime={setEatTime}
      />

      <Tabs defaultValue="manual" onValueChange={setActiveTab}>
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
                    onSubmit={handleSubmit(onSubmitManual)}
                    className="space-y-4"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setShowScanner(true)}
                    >
                      <ScanBarcode className="h-4 w-4" />
                      バーコードから読み取る
                    </Button>
                    {scannedBarcode && (
                      <div className="bg-muted text-muted-foreground flex items-center justify-between rounded-md px-3 py-2 text-sm">
                        <span>バーコード: {scannedBarcode}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => {
                            setScannedBarcode(null);
                            setMappedFoodData(null);
                          }}
                        >
                          クリア
                        </Button>
                      </div>
                    )}
                    <div className="space-y-2 rounded-md border border-dashed p-3">
                      <Label htmlFor="barcodeLookup">
                        バーコードのマッピング確認
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="barcodeLookup"
                          value={barcodeLookupInput}
                          onChange={(event) =>
                            setBarcodeLookupInput(event.target.value)
                          }
                          placeholder="例: 4900000000000"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleLookupBarcode}
                        >
                          確認
                        </Button>
                      </div>
                      {scannedBarcode && (
                        <div className="bg-muted rounded-md p-3 text-sm">
                          <p className="font-medium">
                            現在のバーコード: {scannedBarcode}
                          </p>
                          {mappedFoodData ? (
                            <ul className="text-muted-foreground mt-2 space-y-1">
                              <li>食品名: {mappedFoodData.name}</li>
                              <li>
                                P/F/C: {mappedFoodData.protein} /{' '}
                                {mappedFoodData.fat} / {mappedFoodData.carbs} g
                              </li>
                              <li>カロリー: {mappedFoodData.calories} kcal</li>
                              <li>店名: {mappedFoodData.store || '未設定'}</li>
                            </ul>
                          ) : (
                            <p className="text-muted-foreground mt-2">
                              このバーコードに対応するマッピングは未登録です。
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>食品名</Label>
                      <Input
                        {...register('name', { required: true })}
                        placeholder="例: ランチセット"
                      />
                      {similarFoods.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <p className="text-muted-foreground text-xs">
                            似ている食品候補
                          </p>
                          <div className="space-y-2">
                            {similarFoods.map((food) => (
                              <button
                                key={food.id}
                                type="button"
                                className="hover:bg-muted/80 w-full rounded-md border p-2 text-left transition-colors"
                                onClick={() => handleApplySuggestion(food)}
                              >
                                <p className="text-sm font-medium">
                                  {food.name}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  P:{food.protein} F:{food.fat} C:{food.carbs}{' '}
                                  / {food.calories}kcal
                                  {food.store ? ` / ${food.store}` : ''}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <PfcMacroInputs register={register} step="0.01" valueAsNumber />
                    <DatalistInput
                      register={register}
                      name="store"
                      label="店名 / ブランド (任意)"
                      listId="store-suggestions"
                      options={uniqueStores}
                      placeholder="例: セブンイレブン"
                    />
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="saveToDict"
                        checked={saveToDictionary}
                        onCheckedChange={(checked) =>
                          setSaveToDictionary(checked as boolean)
                        }
                      />
                      <Label
                        htmlFor="saveToDict"
                        className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        入力を食品リストにも保存する
                      </Label>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />{' '}
                          追加中...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" /> 記録を追加
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="photo" className="mt-4">
              <Card>
                <CardContent className="space-y-4 pt-6 text-center">
                  <div className="text-muted-foreground flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6">
                    <Camera className="mb-2 h-10 w-10" />
                    <p className="mb-3">写真を撮る / 選ぶ</p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isExtractingText}
                    >
                      画像を選択する
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
                      onChange={(event) =>
                        handleExtractTextFromImage(
                          event.target.files?.[0] ?? null,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="aiInputText">
                      食べた内容をテキストで入力
                    </Label>
                    <Input
                      id="aiInputText"
                      value={aiInputText}
                      onChange={(event) => setAiInputText(event.target.value)}
                      placeholder="例: コンビニのおにぎり2個とサラダチキン"
                    />
                    <Button
                      type="button"
                      className="w-full"
                      onClick={handleEstimateByAi}
                      disabled={isEstimatingNutrition || isExtractingText}
                    >
                      {isEstimatingNutrition
                        ? 'AIで推定中...'
                        : 'AIでPFCを入力する'}
                    </Button>
                    {isExtractingText && (
                      <p className="text-muted-foreground text-xs">
                        OCR処理中です。完了までしばらくお待ちください。
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      推定結果は手動入力フォームに反映されます。必要に応じて調整してください。
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>

      {showScanner && (
        <BarcodeScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
