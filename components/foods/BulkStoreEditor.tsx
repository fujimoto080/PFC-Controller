'use client';

import { useState } from 'react';
import { LabeledInput } from '@/components/input/FormFields';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface BulkStoreEditorProps {
  selectedCount: number;
  storeOptions: string[];
  groupOptions: string[];
  onApply: (store: string | undefined, storeGroup: string | undefined) => void;
  onCancel: () => void;
}

/** 選択中の食品の店舗・店内グループを一括変更する下部バー。 */
export function BulkStoreEditor({
  selectedCount,
  storeOptions,
  groupOptions,
  onApply,
  onCancel,
}: BulkStoreEditorProps) {
  const [store, setStore] = useState('');
  const [storeGroup, setStoreGroup] = useState('');

  return (
    <div className="fixed inset-x-0 bottom-16 z-50 px-4">
      <Card>
        <CardContent className="space-y-3 pt-4">
          <p className="text-sm font-medium">{selectedCount}件を選択中</p>
          <LabeledInput
            label="店舗（未入力でその他）"
            value={store}
            onChange={(e) => {
              setStore(e.target.value);
            }}
            placeholder="店舗名を入力"
            options={storeOptions}
          />
          <LabeledInput
            label="店内グループ（未入力で未分類）"
            value={storeGroup}
            onChange={(e) => {
              setStoreGroup(e.target.value);
            }}
            placeholder="グループ名を入力"
            options={groupOptions}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              キャンセル
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                onApply(
                  store.trim() || undefined,
                  storeGroup.trim() || undefined,
                );
              }}
              disabled={selectedCount === 0}
            >
              保存
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
