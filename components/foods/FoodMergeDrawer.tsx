'use client';

import { useId, useRef, useState } from 'react';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { RecordDrawer } from '@/components/record/RecordDrawer';
import { Button } from '@/components/ui/button';
import { mergeFoods } from '@/lib/client/actions';
import { toast } from '@/lib/toast';
import type { FoodItem } from '@/lib/types';

interface FoodMergeDrawerProps {
  foods: FoodItem[];
  onDone: () => void;
  onClose: () => void;
}

export function FoodMergeDrawer({
  foods,
  onDone,
  onClose,
}: FoodMergeDrawerProps) {
  const [targetId, setTargetId] = useState('');
  const [saving, setSaving] = useState(false);
  const choiceId = useId();
  const savingRef = useRef(false);
  const target = foods.find(({ id }) => id === targetId);
  const close = () => {
    if (!savingRef.current) onClose();
  };

  const submit = async () => {
    if (!target || foods.length < 2 || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const sourceIds = foods
      .map(({ id }) => id)
      .filter((id) => id !== target.id);
    const saved = await mergeFoods(target.id, sourceIds);
    savingRef.current = false;
    setSaving(false);
    if (saved) {
      toast.success(`「${target.name}」に統合しました`);
      onDone();
    }
  };

  return (
    <RecordDrawer open onClose={close} title="食品の名寄せ">
      <fieldset disabled={saving} className="space-y-3">
        <legend className="mb-2 text-sm font-medium">残す食品を選択</legend>
        <div className="space-y-2">
          {foods.map((food, index) => (
            <div
              key={food.id}
              className="relative flex items-center gap-3 rounded-lg border p-3"
            >
              <input
                id={`${choiceId}-${index}`}
                type="radio"
                name="merge-target"
                checked={targetId === food.id}
                onChange={() => {
                  setTargetId(food.id);
                }}
              />
              <div>
                <label
                  className="block cursor-pointer font-medium after:absolute after:inset-0"
                  htmlFor={`${choiceId}-${index}`}
                >
                  {food.name}
                </label>
                <PfcMacroLine food={food} />
                <span className="text-muted-foreground block text-xs">
                  {food.store?.length ? food.store : '店舗未設定'}
                  {food.storeGroup && ` / ${food.storeGroup}`}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-sm">
          選んだ食品の名前と栄養値を使います。過去の摂取記録はそのまま残ります。
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={close}>
            キャンセル
          </Button>
          <Button
            className="flex-1"
            disabled={!target || foods.length < 2}
            onClick={() => {
              void submit();
            }}
          >
            {saving ? '統合中…' : `${foods.length}件を1件に統合`}
          </Button>
        </div>
      </fieldset>
    </RecordDrawer>
  );
}
