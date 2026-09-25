'use client';

import { useId } from 'react';
import {
  type FieldValues,
  type Path,
  type UseFormRegister,
} from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MACROS } from '@/lib/macros';

const FIELDS = [
  ...MACROS.map(({ key, label }) => ({ key, label: `${label} (g)` })),
  { key: 'calories', label: 'カロリー (kcal)' },
] as const;

/** P/F/C/カロリーの数値入力 2 列グリッド。値は number として登録する。 */
export function PfcMacroInputs<T extends FieldValues>({
  register,
}: {
  register: UseFormRegister<T>;
}) {
  const idPrefix = useId();
  return (
    <div className="grid grid-cols-2 gap-4">
      {FIELDS.map(({ key, label }) => (
        <div key={key} className="space-y-2">
          <Label htmlFor={`${idPrefix}-${key}`}>{label}</Label>
          <Input
            id={`${idPrefix}-${key}`}
            type="number"
            step="any"
            placeholder="0"
            {...register(key as Path<T>, { valueAsNumber: true })}
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

/** datalist によるサジェスト付きテキスト入力。店名・店内グループなど自由入力 + 候補提示に使う。 */
export function DatalistInput<T extends FieldValues>({
  register,
  name,
  label,
  listId,
  options,
  placeholder,
}: DatalistInputProps<T>) {
  const inputId = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        {...register(name)}
        placeholder={placeholder}
        list={listId}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}
