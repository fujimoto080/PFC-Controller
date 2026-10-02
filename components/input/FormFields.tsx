'use client';

import { useId, type ComponentProps } from 'react';
import {
  type FieldValues,
  type Path,
  type UseFormRegister,
} from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MACROS } from '@/lib/macros';

interface LabeledInputProps extends ComponentProps<typeof Input> {
  label: string;
  /** 指定すると datalist による入力候補を付ける（店名・店内グループなど）。 */
  options?: string[];
}

/** ラベル付きのテキスト入力。options を渡すと自由入力 + 候補提示になる。 */
export function LabeledInput({
  label,
  options,
  ...inputProps
}: LabeledInputProps) {
  const inputId = useId();
  const listId = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input id={inputId} list={options && listId} {...inputProps} />
      {options && (
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </div>
  );
}

const MACRO_FIELDS = [
  ...MACROS.map(({ key, label }) => ({ key, label, unit: 'g' })),
  { key: 'calories', label: 'カロリー', unit: 'kcal' },
] as const;

/**
 * P/F/C/カロリーの数値入力。値は 3〜4 桁に収まる前提で 4 列 1 行に並べ、数字キーボードで入力する。
 * 単位は入力欄の右下隅に小さく添える。
 */
export function PfcMacroInputs<T extends FieldValues>({
  register,
}: {
  register: UseFormRegister<T>;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {MACRO_FIELDS.map(({ key, label, unit }) => (
        <div key={key} className="space-y-1.5">
          <Label htmlFor={`macro-${key}`}>{label}</Label>
          <div className="relative">
            <Input
              id={`macro-${key}`}
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="0"
              className="h-12 px-2 pt-0 pb-3 text-center"
              {...register(key as Path<T>, { valueAsNumber: true })}
            />
            <span className="text-muted-foreground pointer-events-none absolute right-2 bottom-1 text-[10px] leading-none">
              {unit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
