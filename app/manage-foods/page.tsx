'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Star,
  Trash,
} from 'lucide-react';
import { BulkStoreEditor } from '@/components/foods/BulkStoreEditor';
import { FoodEditor } from '@/components/foods/FoodEditor';
import { EatDateTimeCard } from '@/components/input/EatDateTimeFields';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { PageTitle } from '@/components/ui/page-title';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import { buildFoodMatchKey, type FoodMatchKeyInput } from '@/lib/barcode';
import {
  deleteFood,
  logFood,
  toggleFavoriteFood,
  updateFood,
} from '@/lib/client/actions';
import { fetchBarcodeMappings } from '@/lib/client/api';
import { useAppState } from '@/lib/client/store';
import {
  STORAGE_KEY_MANAGE_FOODS_COLLAPSE,
  buildStoreSections,
  collectStores,
  readCollapseState,
} from '@/lib/store-sections';
import { toast } from '@/lib/toast';
import type { FoodItem } from '@/lib/types';

/** 編集フォームの状態。null は一覧表示、food: null は新規追加。 */
type EditorState = { food: FoodItem | null } | null;

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export default function ManageFoodsPage() {
  const { foods, logs, settings } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [editor, setEditor] = useState<EditorState>(null);
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[] | null>(null);
  const [barcodesByFoodKey, setBarcodesByFoodKey] = useState<
    Record<string, string[]>
  >({});
  const [collapse, setCollapse] = useState(readCollapseState);
  const { eatDate, setEatDate, eatTime, setEatTime, getSelectedTimestamp } =
    useEatDateTime();

  const storeOptions = useMemo(() => collectStores(foods, logs), [foods, logs]);
  const groupOptions = useMemo(
    () =>
      Array.from(
        new Set(foods.flatMap((food) => food.storeGroup ?? [])),
      ).sort(),
    [foods],
  );
  const sections = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return buildStoreSections(
      foods.filter((food) => food.name.toLowerCase().includes(query)),
    );
  }, [foods, searchQuery]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY_MANAGE_FOODS_COLLAPSE,
      JSON.stringify(collapse),
    );
  }, [collapse]);

  useEffect(() => {
    fetchBarcodeMappings()
      .then((rows) => {
        const mappings: Record<string, string[]> = {};
        for (const { barcode, food } of rows) {
          (mappings[buildFoodMatchKey(food)] ??= []).push(barcode);
        }
        setBarcodesByFoodKey(mappings);
      })
      .catch((error: unknown) => {
        // 一覧表示の補助情報なので UI には出さずログのみ
        console.error('バーコードマッピングの取得に失敗しました', error);
      });
  }, []);

  const barcodesOf = (food: FoodMatchKeyInput) =>
    barcodesByFoodKey[buildFoodMatchKey(food)] ?? [];

  const handleBarcodesSaved = (food: FoodMatchKeyInput, barcodes: string[]) => {
    const key = buildFoodMatchKey(food);
    setBarcodesByFoodKey((prev) => ({
      ...prev,
      [key]: Array.from(new Set([...(prev[key] ?? []), ...barcodes])),
    }));
  };

  const handleDelete = (food: FoodItem) => {
    if (confirm(`「${food.name}」を削除してもよろしいですか？`)) {
      void deleteFood(food.id);
    }
  };

  const handleAddLog = async (food: FoodItem) => {
    if (await logFood(food, getSelectedTimestamp())) {
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

  const isSelecting = selectedFoodIds !== null;

  return (
    <div className="space-y-6 pb-28">
      <PageTitle>食品データ管理</PageTitle>

      <div className="px-4">
        {editor ? (
          <FoodEditor
            key={editor.food?.id ?? 'new'}
            food={editor.food}
            initialBarcodes={editor.food ? barcodesOf(editor.food) : []}
            storeOptions={storeOptions}
            groupOptions={groupOptions}
            onBarcodesSaved={handleBarcodesSaved}
            onClose={() => {
              setEditor(null);
            }}
          />
        ) : (
          <div className="space-y-4">
            <EatDateTimeCard
              eatDate={eatDate}
              setEatDate={setEatDate}
              eatTime={eatTime}
              setEatTime={setEatTime}
            />

            <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 -mx-4 space-y-2 px-4 py-2 backdrop-blur">
              <div className="flex gap-2">
                {!isSelecting && (
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

            <div className="space-y-2">
              {sections.length === 0 ? (
                <p>食品が見つかりません</p>
              ) : (
                sections.map((section) => {
                  const isStoreCollapsed = collapse.collapsedStores.includes(
                    section.storeName,
                  );
                  return (
                    <div key={section.storeName} className="pb-4">
                      <CollapseToggle
                        collapsed={isStoreCollapsed}
                        className="bg-muted/30 mb-2 rounded px-2 py-1 text-sm font-semibold"
                        onClick={() => {
                          setCollapse((prev) => ({
                            ...prev,
                            collapsedStores: toggle(
                              prev.collapsedStores,
                              section.storeName,
                            ),
                          }));
                        }}
                      >
                        {section.storeName}
                      </CollapseToggle>

                      {!isStoreCollapsed && (
                        <div className="space-y-3">
                          {section.groups.map((group) => {
                            const groupKey = `${section.storeName}::${group.groupName}`;
                            const isGroupCollapsed =
                              collapse.collapsedGroups.includes(groupKey);
                            return (
                              <div
                                key={groupKey}
                                className="bg-background space-y-2 rounded-md border p-2"
                              >
                                <CollapseToggle
                                  collapsed={isGroupCollapsed}
                                  className="px-1 text-xs font-medium"
                                  onClick={() => {
                                    setCollapse((prev) => ({
                                      ...prev,
                                      collapsedGroups: toggle(
                                        prev.collapsedGroups,
                                        groupKey,
                                      ),
                                    }));
                                  }}
                                >
                                  {group.groupName}
                                </CollapseToggle>

                                {!isGroupCollapsed && (
                                  <div className="space-y-2">
                                    {group.foods.map((food) => (
                                      <FoodRow
                                        key={food.id}
                                        food={food}
                                        barcodes={barcodesOf(food)}
                                        isFavorite={settings.favoriteFoodIds.includes(
                                          food.id,
                                        )}
                                        selected={
                                          selectedFoodIds?.includes(food.id) ??
                                          null
                                        }
                                        onToggleSelect={() => {
                                          setSelectedFoodIds(
                                            (prev) =>
                                              prev && toggle(prev, food.id),
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
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {selectedFoodIds && (
        <BulkStoreEditor
          selectedCount={selectedFoodIds.length}
          onApply={applyBulkUpdate}
          onCancel={() => {
            setSelectedFoodIds(null);
          }}
        />
      )}
    </div>
  );
}

function CollapseToggle({
  collapsed,
  className,
  onClick,
  children,
}: {
  collapsed: boolean;
  className: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const Icon = collapsed ? ChevronRight : ChevronDown;
  return (
    <button
      type="button"
      className={`text-muted-foreground flex w-full items-center text-left ${className}`}
      onClick={onClick}
    >
      <Icon className="mr-1 h-4 w-4" />
      {children}
    </button>
  );
}

interface FoodRowProps {
  food: FoodItem;
  barcodes: string[];
  isFavorite: boolean;
  /** 選択モードでなければ null */
  selected: boolean | null;
  onToggleSelect: () => void;
  onAddLog: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function FoodRow({
  food,
  barcodes,
  isFavorite,
  selected,
  onToggleSelect,
  onAddLog,
  onToggleFavorite,
  onEdit,
  onDelete,
}: FoodRowProps) {
  const isSelecting = selected !== null;
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border p-3 ${
        selected ? 'border-primary bg-primary/5' : 'bg-card'
      }`}
      onClick={isSelecting ? onToggleSelect : undefined}
    >
      {isSelecting && (
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          onClick={(e) => {
            e.stopPropagation();
          }}
          aria-label={`${food.name}を選択`}
        />
      )}
      <div className="flex-1 pr-2">
        <div className="font-medium">{food.name}</div>
        <PfcMacroLine food={food} />
        {barcodes.length > 0 && (
          <div className="text-muted-foreground text-xs">
            バーコード: {barcodes.join(', ')}
          </div>
        )}
      </div>
      {isSelecting ? (
        <div className="text-primary text-xs">
          {selected ? '選択中' : 'タップで選択'}
        </div>
      ) : (
        <div className="flex gap-1">
          <IconButton onClick={onAddLog}>
            <Plus className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={onToggleFavorite}>
            <Star
              className={`h-4 w-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
            />
          </IconButton>
          <IconButton onClick={onEdit}>
            <Pencil className="text-muted-foreground h-4 w-4" />
          </IconButton>
          <IconButton onClick={onDelete}>
            <Trash className="text-destructive h-4 w-4" />
          </IconButton>
        </div>
      )}
    </div>
  );
}
