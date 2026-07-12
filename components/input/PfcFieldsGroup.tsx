'use client';

import { type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MACROS = [
  { key: 'protein', label: 'タンパク質 (g)' },
  { key: 'fat', label: '脂質 (g)' },
  { key: 'carbs', label: '炭水化物 (g)' },
  { key: 'calories', label: 'カロリー' },
] as const;

interface PfcMacroInputsProps<T extends FieldValues> {
  register: UseFormRegister<T>;
  /** number input の step。既定は 0.1 */
  step?: string;
  /** RHF に数値として登録するか（valueAsNumber） */
  valueAsNumber?: boolean;
  /** id / htmlFor を付与するか（同一ページに複数置く場合は false） */
  withIds?: boolean;
}

/**
 * P/F/C/カロリーの数値入力 2 列グリッド。
 * AddFoodForm / manage-foods / EditLogItemDrawer で共通利用する。
 */
export function PfcMacroInputs<T extends FieldValues>({
  register,
  step = '0.1',
  valueAsNumber = false,
  withIds = false,
}: PfcMacroInputsProps<T>) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {MACROS.map(({ key, label }) => (
        <div key={key} className="space-y-2">
          <Label htmlFor={withIds ? key : undefined}>{label}</Label>
          <Input
            id={withIds ? key : undefined}
            type="number"
            step={step}
            placeholder="0"
            {...register(
              key as unknown as Path<T>,
              valueAsNumber ? { valueAsNumber: true } : undefined,
            )}
          />
        </div>
      ))}
    </div>
  );
}

interface DatalistInputProps<T extends FieldValues> {
  register: UseFormRegister<T>;
  name: Path<T>;
  label: string;
  listId: string;
  options: string[];
  placeholder?: string;
}

/**
 * datalist によるサジェスト付きテキスト入力。店名・店内グループなど自由入力 + 候補提示に使う。
 */
export function DatalistInput<T extends FieldValues>({
  register,
  name,
  label,
  listId,
  options,
  placeholder,
}: DatalistInputProps<T>) {
  const inputId = String(name);
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input id={inputId} {...register(name)} placeholder={placeholder} list={listId} />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}
