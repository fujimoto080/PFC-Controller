'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Save, ScanBarcode, X } from 'lucide-react';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { DatalistInput, PfcMacroInputs } from '@/components/input/PfcFieldsGroup';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeBarcodes, type BarcodeFood } from '@/lib/barcode';
import { addFood, updateFood } from '@/lib/client/actions';
import { saveBarcodeMapping } from '@/lib/client/api';
import { toFoodInput, type PfcFormValues } from '@/lib/food-form';
import { toast } from '@/lib/toast';
import type { FoodItem } from '@/lib/types';
import { generateId } from '@/lib/utils';

interface FoodEditorProps {
  /** 編集対象。null なら新規追加。 */
  food: FoodItem | null;
  initialBarcodes: string[];
  storeOptions: string[];
  groupOptions: string[];
  onBarcodesSaved: (food: BarcodeFood, barcodes: string[]) => void;
  onClose: () => void;
}

export function FoodEditor({
  food,
  initialBarcodes,
  storeOptions,
  groupOptions,
  onBarcodesSaved,
  onClose,
}: FoodEditorProps) {
  const [barcodeInput, setBarcodeInput] = useState(initialBarcodes.join(', '));
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { register, handleSubmit } = useForm<PfcFormValues>({
    defaultValues: food ?? { name: '', protein: 0, fat: 0, carbs: 0, calories: 0 },
  });

  const onSubmit = async (values: PfcFormValues) => {
    const input = toFoodInput(values, Date.now());
    const saved = food
      ? await updateFood({ ...food, ...input })
      : await addFood({ id: generateId(), ...input });
    if (!saved) return;
    toast.success(food ? '食品を更新しました' : '食品を追加しました');

    const barcodes = normalizeBarcodes(barcodeInput);
    if (barcodes.length > 0) {
      try {
        await saveBarcodeMapping(barcodes, input);
        toast.success(`バーコード情報を${barcodes.length}件保存しました`);
        onBarcodesSaved(input, barcodes);
      } catch (error) {
        toast.fromError('バーコード情報の保存に失敗しました', error);
      }
    }
    onClose();
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-4 text-lg font-semibold">{food ? '食品を編集' : '新規食品を追加'}</h2>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-4">
          <div className="space-y-2">
            <Label>食品名</Label>
            <Input {...register('name', { required: true })} placeholder="例: ハンバーグ" />
          </div>
          <PfcMacroInputs register={register} step="0.1" />
          <DatalistInput
            register={register}
            name="store"
            label="店名 / ブランド (任意)"
            listId="store-suggestions"
            options={storeOptions}
            placeholder="例: セブンイレブン"
          />
          <DatalistInput
            register={register}
            name="storeGroup"
            label="店内グループ (任意)"
            listId="store-group-suggestions"
            options={groupOptions}
            placeholder="例: おにぎり"
          />
          <div className="space-y-2">
            <Label htmlFor="barcode">バーコード (任意・複数可)</Label>
            <div className="flex gap-2">
              <Input
                id="barcode"
                value={barcodeInput}
                onChange={(event) => { setBarcodeInput(event.target.value); }}
                placeholder="例: 4901234567890"
              />
              <Button type="button" variant="outline" onClick={() => { setIsScannerOpen(true); }}>
                <ScanBarcode className="mr-2 h-4 w-4" />
                スキャン
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              カンマ・読点・空白区切りで複数バーコードを同時に紐づけできます。
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              <X className="mr-2 h-4 w-4" /> キャンセル
            </Button>
            <Button type="submit" className="flex-1">
              <Save className="mr-2 h-4 w-4" /> 保存
            </Button>
          </div>
        </form>
      </CardContent>

      {isScannerOpen && (
        <BarcodeScanner
          onScanSuccess={(code) => {
            setBarcodeInput(code);
            setIsScannerOpen(false);
            toast.success(`バーコードを読み取りました: ${code}`);
          }}
          onClose={() => { setIsScannerOpen(false); }}
        />
      )}
    </Card>
  );
}
