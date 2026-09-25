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
  ...MACROS.map(({ key, label }) => ({ key, label: `${label} (g)` })),
  { key: 'calories', label: 'カロリー (kcal)' },
] as const;

/** P/F/C/カロリーの数値入力 2 列グリッド。値は number として登録する。 */
export function PfcMacroInputs<T extends FieldValues>({
  register,
}: {
  register: UseFormRegister<T>;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {MACRO_FIELDS.map(({ key, label }) => (
        <LabeledInput
          key={key}
          label={label}
          type="number"
          step="any"
          placeholder="0"
          {...register(key as Path<T>, { valueAsNumber: true })}
        />
      ))}
    </div>
  );
}
