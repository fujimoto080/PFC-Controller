'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { BulkStoreEditor } from '@/components/foods/BulkStoreEditor';
import { CollapsibleSection } from '@/components/foods/CollapsibleSection';
import { FoodEditor } from '@/components/foods/FoodEditor';
import { FoodMergeCandidates } from '@/components/foods/FoodMergeCandidates';
import { FoodMergeDrawer } from '@/components/foods/FoodMergeDrawer';
import { FoodRow } from '@/components/foods/FoodRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageTitle } from '@/components/ui/page-title';
import { useBarcodesByFood } from '@/hooks/use-barcodes-by-food';
import { useCollapsedKeys } from '@/hooks/use-collapsed-keys';
import {
  deleteFood,
  toggleFavoriteFood,
  updateFood,
} from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';
import { findFoodMergeCandidates } from '@/lib/food-suggestions';
import {
  buildStoreSections,
  collectStoreGroups,
  collectStores,
} from '@/lib/store-sections';
import { toast } from '@/lib/toast';
import type { FoodItem } from '@/lib/types';
import { toggleItem } from '@/lib/utils';
import { StatusMessage } from '@/components/ui/status-message';

/** 編集フォームの状態。null は一覧表示、food: null は新規追加。 */
type EditorState = { food: FoodItem | null } | null;
type Selection = { mode: 'store' | 'merge'; ids: string[] };

// 折りたたみ中の店舗・グループのキー一覧を保存する
const COLLAPSED_STORAGE_KEY = 'pfc_manage_foods_collapsed';

const storeKey = (store: string) => `store:${store}`;
const groupKey = (store: string, group: string) => `group:${store}::${group}`;

export default function FoodsPage() {
  const { foods, logs, settings } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [editor, setEditor] = useState<EditorState>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [reviewMerge, setReviewMerge] = useState(false);
  const collapsed = useCollapsedKeys(COLLAPSED_STORAGE_KEY);
  const { barcodesOf, registeredBarcodesOf, addBarcodes } = useBarcodesByFood();
  const selectedFoods = selection
    ? foods.filter((food) => selection.ids.includes(food.id))
    : [];
  const isMerging = selection?.mode === 'merge';
  const mergeCandidates = useMemo(
    () => (isMerging ? findFoodMergeCandidates(foods) : []),
    [foods, isMerging],
  );

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

  const applyBulkUpdate = (
    store: string | undefined,
    storeGroup: string | undefined,
  ) => {
    for (const food of selectedFoods) {
      void updateFood({ ...food, store, storeGroup, timestamp: Date.now() });
    }
    toast.success('選択した食品の店舗とグループを更新しました');
    setSelection(null);
  };

  if (editor) {
    return (
      <div className="space-y-4">
        <PageTitle>食品リスト</PageTitle>
        <div className="px-4">
          <FoodEditor
            key={editor.food?.id ?? 'new'}
            food={editor.food}
            initialBarcodes={editor.food ? registeredBarcodesOf(editor.food) : []}
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
    <div className="space-y-4">
      <PageTitle>食品リスト</PageTitle>

      <div className="space-y-4 px-4">
        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 -mx-4 space-y-2 px-4 py-2 backdrop-blur">
          <div className="flex gap-2">
            <Input
              placeholder="食品を検索..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
            />
            <Button
              disabled={selection !== null}
              onClick={() => {
                setEditor({ food: null });
              }}
            >
              <Plus /> 新規
            </Button>
          </div>
          {selection === null && (
            <div className="flex flex-wrap gap-x-4">
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0"
                onClick={() => {
                  setSelection({ mode: 'store', ids: [] });
                }}
              >
                店舗・グループをまとめて変更
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0"
                disabled={foods.length < 2}
                onClick={() => {
                  setSelection({ mode: 'merge', ids: [] });
                }}
              >
                食品を名寄せ
              </Button>
            </div>
          )}
          {isMerging && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">{selectedFoods.length}件を選択中</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelection(null);
                  }}
                >
                  キャンセル
                </Button>
                <Button
                  size="sm"
                  disabled={selectedFoods.length < 2}
                  onClick={() => {
                    setReviewMerge(true);
                  }}
                >
                  残す食品を選ぶ
                </Button>
              </div>
            </div>
          )}
        </div>

        {isMerging && (
          <FoodMergeCandidates
            candidates={mergeCandidates}
            onSelect={(ids) => {
              setSelection({ mode: 'merge', ids });
            }}
          />
        )}

        {sections.length === 0 ? (
          <StatusMessage>食品が見つかりません</StatusMessage>
        ) : (
          <div className="space-y-4">
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
                          selected={selection?.ids.includes(food.id) ?? null}
                          onToggleSelect={() => {
                            setSelection(
                              (prev) =>
                                prev && {
                                  ...prev,
                                  ids: toggleItem(prev.ids, food.id),
                                },
                            );
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

      {selection?.mode === 'store' && (
        <BulkStoreEditor
          selectedCount={selectedFoods.length}
          storeOptions={storeOptions}
          groupOptions={groupOptions}
          onApply={applyBulkUpdate}
          onCancel={() => {
            setSelection(null);
          }}
        />
      )}
      {reviewMerge && (
        <FoodMergeDrawer
          foods={selectedFoods}
          onClose={() => {
            setReviewMerge(false);
          }}
          onDone={() => {
            setReviewMerge(false);
            setSelection(null);
          }}
        />
      )}
    </div>
  );
}
