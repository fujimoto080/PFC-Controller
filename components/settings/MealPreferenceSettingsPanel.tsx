'use client';

import { useId, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CHAIN_STORES } from '@/lib/chain-stores';
import { saveSettings } from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';
import { collectStores } from '@/lib/store-sections';
import { toast } from '@/lib/toast';
import type { StorePreference } from '@/lib/types';

/** 「、」「,」や改行で区切った入力を食材名の配列にする。 */
function splitWords(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[、,，\n]/)
        .map((word) => word.trim())
        .filter(Boolean),
    ),
  ];
}

/** 食事提案で参考にする苦手な食材と、お店ごとの定番メニュー。 */
export function MealPreferenceSettingsPanel() {
  const { settings, foods, logs } = useAppState();
  const preferences = settings.mealPreferences;
  const [dislikes, setDislikes] = useState(
    preferences?.dislikes.join('、') ?? '',
  );
  const [stores, setStores] = useState<StorePreference[]>(
    preferences?.stores ?? [],
  );
  const storeOptions = useMemo(
    () =>
      [
        ...new Set([
          ...CHAIN_STORES.map((c) => c.name),
          ...collectStores(foods, logs),
        ]),
      ].sort(),
    [foods, logs],
  );
  const storeListId = useId();

  const updateStore = (index: number, patch: Partial<StorePreference>) => {
    setStores((current) =>
      current.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  };

  const handleSave = async () => {
    const mealPreferences = {
      dislikes: splitWords(dislikes),
      stores: stores
        .map((s) => ({ store: s.store.trim(), menu: s.menu.trim() }))
        .filter((s) => s.store !== '' && s.menu !== ''),
    };
    if (await saveSettings({ ...settings, mealPreferences })) {
      setDislikes(mealPreferences.dislikes.join('、'));
      setStores(mealPreferences.stores);
      toast.success('食の好みを保存しました');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>食の好み</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-muted-foreground text-sm">
          食事の提案で AI が参考にします。
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="dislikes">苦手な食材</Label>
          <Input
            id="dislikes"
            value={dislikes}
            onChange={(e) => {
              setDislikes(e.target.value);
            }}
            placeholder="例: パクチー、レバー、セロリ"
          />
          <p className="text-muted-foreground text-xs">
            「、」で区切って複数入力できます。
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">お店ごとのメニュー</p>
          <datalist id={storeListId}>
            {storeOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          {stores.map((pref, index) => (
            // 並べ替えは無く、追加・削除だけなので index を key にする
            <div key={index} className="space-y-1.5 rounded-lg border p-2">
              <div className="flex items-center gap-2">
                <Input
                  aria-label="店名"
                  list={storeListId}
                  value={pref.store}
                  onChange={(e) => {
                    updateStore(index, { store: e.target.value });
                  }}
                  placeholder="店名（例: すき家）"
                />
                <IconButton
                  aria-label={`${pref.store || 'このお店'}を削除`}
                  onClick={() => {
                    setStores((current) =>
                      current.filter((_, i) => i !== index),
                    );
                  }}
                >
                  <X />
                </IconButton>
              </div>
              <Input
                aria-label={`${pref.store || 'このお店'}のメニュー`}
                value={pref.menu}
                onChange={(e) => {
                  updateStore(index, { menu: e.target.value });
                }}
                placeholder="例: 牛丼ミニ＋サラダ＋とん汁が定番。紅しょうがは不要"
              />
            </div>
          ))}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setStores((current) => [...current, { store: '', menu: '' }]);
            }}
          >
            <Plus />
            お店を追加
          </Button>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => {
              void handleSave();
            }}
          >
            好みを保存
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
