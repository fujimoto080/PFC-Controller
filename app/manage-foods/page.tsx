'use client';

import { useMemo, useState } from 'react';
import { BulkStoreEditor } from '@/components/foods/BulkStoreEditor';
import { CollapsibleSection } from '@/components/foods/CollapsibleSection';
import { FoodEditor } from '@/components/foods/FoodEditor';
import { FoodRow } from '@/components/foods/FoodRow';
import { EatDateTimeCard } from '@/components/input/EatDateTimeFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageTitle } from '@/components/ui/page-title';
import { useBarcodesByFood } from '@/hooks/use-barcodes-by-food';
import { useCollapsedKeys } from '@/hooks/use-collapsed-keys';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import {
  deleteFood,
  logFood,
  toggleFavoriteFood,
  updateFood,
} from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';
import {
  buildStoreSections,
  collectStoreGroups,
  collectStores,
} from '@/lib/store-sections';
import { toast } from '@/lib/toast';
import type { FoodItem } from '@/lib/types';
import { toggleItem } from '@/lib/utils';

/** 編集フォームの状態。null は一覧表示、food: null は新規追加。 */
type EditorState = { food: FoodItem | null } | null;

// 折りたたみ中の店舗・グループのキー一覧を保存する
const COLLAPSED_STORAGE_KEY = 'pfc_manage_foods_collapsed';

const storeKey = (store: string) => `store:${store}`;
const groupKey = (store: string, group: string) => `group:${store}::${group}`;

export default function ManageFoodsPage() {
  const { foods, logs, settings } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [editor, setEditor] = useState<EditorState>(null);
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[] | null>(null);
  const collapsed = useCollapsedKeys(COLLAPSED_STORAGE_KEY);
  const eatAt = useEatDateTime();
  const { barcodesOf, addBarcodes } = useBarcodesByFood();

  const storeOptions = useMemo(() => collectStores(foods, logs), [foods, logs]);
  const groupOptions = useMemo(() => collectStoreGroups(foods), [foods]);
  const sections = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return buildStoreSections(
      foods.filter((food) => food.name.toLowerCase().includes(query)),
    );
  }, [foods, searchQuery]);

  const handleDelete = (food: FoodItem) => {
    if (confirm(`「${food.name}」を削除してもよろしいですか？`)) {
      void deleteFood(food.id);
    }
  };

  const handleAddLog = async (food: FoodItem) => {
    if (await logFood(food, eatAt.timestamp)) {
      toast.success(`${food.name}を食事記録に追加しました`);
    }
  };

  const applyBulkUpdate = (
    store: string | undefined,
    storeGroup: string | undefined,
  ) => {
    const selected = new Set(selectedFoodIds);
    for (const food of foods) {
      if (selected.has(food.id)) {
        void updateFood({ ...food, store, storeGroup, timestamp: Date.now() });
      }
    }
    toast.success('選択した食品の店舗とグループを更新しました');
    setSelectedFoodIds(null);
  };

  if (editor) {
    return (
      <div className="space-y-6 pb-28">
        <PageTitle>食品データ管理</PageTitle>
        <div className="px-4">
          <FoodEditor
            key={editor.food?.id ?? 'new'}
            food={editor.food}
            initialBarcodes={editor.food ? barcodesOf(editor.food) : []}
            storeOptions={storeOptions}
            groupOptions={groupOptions}
            onBarcodesSaved={addBarcodes}
            onClose={() => {
              setEditor(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <PageTitle>食品データ管理</PageTitle>

      <div className="space-y-4 px-4">
        <EatDateTimeCard value={eatAt.value} onChange={eatAt.onChange} />

        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 -mx-4 space-y-2 px-4 py-2 backdrop-blur">
          <div className="flex gap-2">
            {selectedFoodIds === null && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedFoodIds([]);
                }}
              >
                店舗/グループ変更
              </Button>
            )}
            <Button
              onClick={() => {
                setEditor({ food: null });
              }}
              aria-label="新規追加"
            >
              +
            </Button>
          </div>
          <Input
            placeholder="食品を検索..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
          />
        </div>

        {sections.length === 0 ? (
          <p>食品が見つかりません</p>
        ) : (
          <div className="space-y-6">
            {sections.map(({ storeName, groups }) => (
              <CollapsibleSection
                key={storeName}
                title={storeName}
                collapsed={collapsed.isCollapsed(storeKey(storeName))}
                onToggle={() => {
                  collapsed.toggle(storeKey(storeName));
                }}
                variant="store"
              >
                {groups.map(({ groupName, foods: groupFoods }) => {
                  const key = groupKey(storeName, groupName);
                  return (
                    <CollapsibleSection
                      key={key}
                      title={groupName}
                      collapsed={collapsed.isCollapsed(key)}
                      onToggle={() => {
                        collapsed.toggle(key);
                      }}
                      variant="group"
                    >
                      {groupFoods.map((food) => (
                        <FoodRow
                          key={food.id}
                          food={food}
                          barcodes={barcodesOf(food)}
                          isFavorite={settings.favoriteFoodIds.includes(
                            food.id,
                          )}
                          selected={selectedFoodIds?.includes(food.id) ?? null}
                          onToggleSelect={() => {
                            setSelectedFoodIds(
                              (prev) => prev && toggleItem(prev, food.id),
                            );
                          }}
                          onAddLog={() => {
                            void handleAddLog(food);
                          }}
                          onToggleFavorite={() => {
                            void toggleFavoriteFood(food.id);
                          }}
                          onEdit={() => {
                            setEditor({ food });
                          }}
                          onDelete={() => {
                            handleDelete(food);
                          }}
                        />
                      ))}
                    </CollapsibleSection>
                  );
                })}
              </CollapsibleSection>
            ))}
          </div>
        )}
      </div>

      {selectedFoodIds && (
        <BulkStoreEditor
          selectedCount={selectedFoodIds.length}
          storeOptions={storeOptions}
          groupOptions={groupOptions}
          onApply={applyBulkUpdate}
          onCancel={() => {
            setSelectedFoodIds(null);
          }}
        />
      )}
    </div>
  );
}
