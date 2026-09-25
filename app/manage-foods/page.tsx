'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { buildFoodMatchKey, type BarcodeFood } from '@/lib/barcode';
import {
  deleteFood,
  logFood,
  toggleFavoriteFood,
  updateFood,
} from '@/lib/client/actions';
import { fetchBarcodeMappings } from '@/lib/client/api';
import { useAppState } from '@/lib/client/store';
import {
  buildStoreSections,
  collectStoreGroups,
  collectStores,
} from '@/lib/store-sections';
import { toast } from '@/lib/toast';
import type { FoodItem } from '@/lib/types';
import { cn, toggleItem } from '@/lib/utils';

/** 編集フォームの状態。null は一覧表示、food: null は新規追加。 */
type EditorState = { food: FoodItem | null } | null;

// 折りたたみ中の店舗・グループのキー一覧を保存する
const COLLAPSED_STORAGE_KEY = 'pfc_manage_foods_collapsed';

const storeKey = (store: string) => `store:${store}`;
const groupKey = (store: string, group: string) => `group:${store}::${group}`;

function readCollapsed(): string[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(COLLAPSED_STORAGE_KEY) ?? '[]',
    );
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** バーコードマッピングを「食品の突き合わせキー → バーコード一覧」に畳み込んで取得する。 */
function useBarcodesByFood() {
  const [byKey, setByKey] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchBarcodeMappings()
      .then((rows) => {
        const mappings: Record<string, string[]> = {};
        for (const { barcode, food } of rows) {
          (mappings[buildFoodMatchKey(food)] ??= []).push(barcode);
        }
        setByKey(mappings);
      })
      .catch((error: unknown) => {
        // 一覧表示の補助情報なので UI には出さずログのみ
        console.error('バーコードマッピングの取得に失敗しました', error);
      });
  }, []);

  const barcodesOf = (food: BarcodeFood) =>
    byKey[buildFoodMatchKey(food)] ?? [];

  const addBarcodes = (food: BarcodeFood, barcodes: string[]) => {
    const key = buildFoodMatchKey(food);
    setByKey((prev) => ({
      ...prev,
      [key]: Array.from(new Set([...(prev[key] ?? []), ...barcodes])),
    }));
  };

  return { barcodesOf, addBarcodes };
}

export default function ManageFoodsPage() {
  const { foods, logs, settings } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [editor, setEditor] = useState<EditorState>(null);
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[] | null>(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
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

  useEffect(() => {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(collapsed));
  }, [collapsed]);

  const toggleCollapsed = (key: string) => {
    setCollapsed((prev) => toggleItem(prev, key));
  };

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
                collapsed={collapsed.includes(storeKey(storeName))}
                onToggle={() => {
                  toggleCollapsed(storeKey(storeName));
                }}
                variant="store"
              >
                {groups.map(({ groupName, foods: groupFoods }) => {
                  const key = groupKey(storeName, groupName);
                  return (
                    <CollapsibleSection
                      key={key}
                      title={groupName}
                      collapsed={collapsed.includes(key)}
                      onToggle={() => {
                        toggleCollapsed(key);
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
          onApply={applyBulkUpdate}
          onCancel={() => {
            setSelectedFoodIds(null);
          }}
        />
      )}
    </div>
  );
}

const SECTION_STYLES = {
  store: {
    container: '',
    header: 'bg-muted/30 mb-2 rounded px-2 py-1 text-sm font-semibold',
    body: 'space-y-3',
  },
  group: {
    container: 'bg-background space-y-2 rounded-md border p-2',
    header: 'px-1 text-xs font-medium',
    body: 'space-y-2',
  },
} as const;

function CollapsibleSection({
  title,
  collapsed,
  onToggle,
  variant,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  variant: keyof typeof SECTION_STYLES;
  children: ReactNode;
}) {
  const styles = SECTION_STYLES[variant];
  const Icon = collapsed ? ChevronRight : ChevronDown;
  return (
    <div className={styles.container}>
      <button
        type="button"
        className={cn(
          'text-muted-foreground flex w-full items-center text-left',
          styles.header,
        )}
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <Icon className="mr-1 h-4 w-4" />
        {title}
      </button>
      {!collapsed && <div className={styles.body}>{children}</div>}
    </div>
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
    // 行クリックは選択の補助操作。キーボード操作は Checkbox で提供する。
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg border p-3',
        selected ? 'border-primary bg-primary/5' : 'bg-card',
      )}
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
          <IconButton onClick={onAddLog} aria-label="食事記録に追加">
            <Plus className="h-4 w-4" />
          </IconButton>
          <IconButton onClick={onToggleFavorite} aria-label="お気に入り">
            <Star
              className={cn(
                'h-4 w-4',
                isFavorite
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground',
              )}
            />
          </IconButton>
          <IconButton onClick={onEdit} aria-label="編集">
            <Pencil className="text-muted-foreground h-4 w-4" />
          </IconButton>
          <IconButton onClick={onDelete} aria-label="削除">
            <Trash className="text-destructive h-4 w-4" />
          </IconButton>
        </div>
      )}
    </div>
  );
}
