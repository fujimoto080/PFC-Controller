'use client';

import { useMemo, useState } from 'react';
import {
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { LabeledInput } from '@/components/input/FormFields';
import { useAppState } from '@/lib/client/store';
import type { PfcFormValues } from '@/lib/food-form';
import { storeLogoUrl } from '@/lib/store-logos';
import { collectFrequentStores } from '@/lib/store-sections';
import { cn } from '@/lib/utils';

/** ボタンで選べるよく使う店の最大数 */
const FREQUENT_STORE_LIMIT = 6;

interface StoreFieldProps {
  register: UseFormRegister<PfcFormValues>;
  control: Control<PfcFormValues>;
  setValue: UseFormSetValue<PfcFormValues>;
  /** 自由入力の候補にする店名 */
  options: string[];
}

/** 店名の入力欄と、よく使う店をロゴで選ぶワンタップのボタン。 */
export function StoreField({
  register,
  control,
  setValue,
  options,
}: StoreFieldProps) {
  const { foods, logs } = useAppState();
  const frequent = useMemo(
    () => collectFrequentStores(foods, logs, FREQUENT_STORE_LIMIT),
    [foods, logs],
  );
  const current = useWatch({ control, name: 'store' });

  return (
    <div className="space-y-2">
      <LabeledInput
        label="店名 / ブランド (任意)"
        {...register('store')}
        options={options}
        placeholder="例: セブンイレブン"
      />
      {frequent.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {frequent.map((store) => {
            const selected = current === store;
            return (
              <button
                key={store}
                type="button"
                title={store}
                aria-label={store}
                aria-pressed={selected}
                onClick={() => {
                  setValue('store', selected ? '' : store, {
                    shouldDirty: true,
                  });
                }}
                className={cn(
                  'bg-background flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                  selected ? 'border-primary ring-primary ring-2' : '',
                )}
              >
                <StoreLogo store={store} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** チェーン・ブランドならロゴ、そうでなければ（または読み込み失敗時）店名の頭文字を表示する。 */
function StoreLogo({ store }: { store: string }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = storeLogoUrl(store);

  if (!logoUrl || failed) {
    return (
      <span className="text-muted-foreground text-sm font-semibold">
        {store.slice(0, 1)}
      </span>
    );
  }
  return (
    // oxlint-disable-next-line nextjs/no-img-element -- 小さなロゴ画像のため最適化は不要
    <img
      src={logoUrl}
      alt=""
      width={24}
      height={24}
      className="h-6 w-6 rounded-sm object-contain"
      onError={() => {
        setFailed(true);
      }}
    />
  );
}
