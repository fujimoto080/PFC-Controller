'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash, Save, X, Star, ChevronDown, ChevronRight, ScanBarcode } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from '@/lib/toast';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    addFoodToDictionary,
    updateFoodInDictionary,
    deleteFoodFromDictionary,
} from '@/lib/storage/foods';
import { toggleFavoriteFood, isFavoriteFood } from '@/lib/storage/favorites';
import { addFoodItem } from '@/lib/storage/logs';
import { FoodItem } from '@/lib/types';
import { toFoodInput } from '@/lib/pfc';
import { PfcMacroInputs, DatalistInput } from '@/components/input/PfcFieldsGroup';
import { EatDateTimeCard } from '@/components/input/EatDateTimeFields';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import {
    STORAGE_KEY_MANAGE_FOODS_COLLAPSE,
    readCollapseState,
    buildStoreSections,
} from '@/lib/store-sections';
import { buildFoodMatchKey, normalizeBarcodes, type BarcodeMappingRow } from '@/lib/barcode-mapping';
import { saveBarcodeMappingRequest } from '@/lib/barcode-client';
import { generateId } from '@/lib/utils';
import { useFoodDictionary } from '@/hooks/use-food-dictionary';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import { PageTitle } from '@/components/ui/page-title';
import { BarcodeScanner } from '@/components/BarcodeScanner';

const getCurrentTimestamp = () => Date.now();

export default function ManageFoodsPage() {
    const { foods, uniqueStores } = useFoodDictionary();
    const [searchQuery, setSearchQuery] = useState('');
    const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([]);
    const [bulkStoreName, setBulkStoreName] = useState('');
    const [bulkGroupName, setBulkGroupName] = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [barcodeMappingsByFoodKey, setBarcodeMappingsByFoodKey] = useState<Record<string, string[]>>({});
    const initialCollapseState = useMemo(() => readCollapseState(), []);
    const [collapsedStores, setCollapsedStores] = useState<string[]>(initialCollapseState.collapsedStores);
    const [collapsedGroups, setCollapsedGroups] = useState<string[]>(initialCollapseState.collapsedGroups);

    const { eatDate, setEatDate, eatTime, setEatTime, getSelectedTimestamp } = useEatDateTime();

    const { register, handleSubmit, reset, setValue } = useForm<FoodItem>();

    const uniqueStoreGroups = useMemo(
        () => Array.from(new Set(foods.map((food) => food.storeGroup).filter(Boolean) as string[])).sort(),
        [foods],
    );


    useEffect(() => {
        localStorage.setItem(
            STORAGE_KEY_MANAGE_FOODS_COLLAPSE,
            JSON.stringify({
                collapsedStores,
                collapsedGroups,
            }),
        );
    }, [collapsedStores, collapsedGroups]);

    useEffect(() => {
        const loadBarcodeMappings = async () => {
            try {
                const response = await fetch('/api/barcode/mappings', { cache: 'no-store' });

                if (!response.ok) {
                    throw new Error('バーコードマッピングの取得に失敗しました');
                }

                const rows = (await response.json()) as BarcodeMappingRow[];
                const mappings = rows.reduce<Record<string, string[]>>((acc, row) => {
                    const key = buildFoodMatchKey(row.food);
                    const current = acc[key] ?? [];
                    if (!current.includes(row.barcode)) {
                        current.push(row.barcode);
                    }
                    acc[key] = current;
                    return acc;
                }, {});

                setBarcodeMappingsByFoodKey(mappings);
            } catch (error) {
                // 取得失敗時は UI に出さず警告ログのみ（既存挙動を維持）
                console.error('バーコードマッピングの取得に失敗しました', error);
            }
        };

        loadBarcodeMappings();
    }, []);

    const startAdd = () => {
        setEditingItem(null);
        setIsAdding(true);
        setBarcodeInput('');
        reset({
            name: '',
            protein: 0,
            fat: 0,
            carbs: 0,
            calories: 0,
            store: '',
            storeGroup: '',
        });
    };

    const startEdit = (item: FoodItem) => {
        setEditingItem(item);
        setIsAdding(true);
        const key = buildFoodMatchKey(item);
        setBarcodeInput((barcodeMappingsByFoodKey[key] ?? []).join(', '));
        setValue('name', item.name);
        setValue('protein', item.protein);
        setValue('fat', item.fat);
        setValue('carbs', item.carbs);
        setValue('calories', item.calories);
        setValue('store', item.store);
        setValue('storeGroup', item.storeGroup);
    };

    const cancelEdit = () => {
        setIsAdding(false);
        setEditingItem(null);
        setBarcodeInput('');
        reset();
    };

    const onSubmit = async (data: FoodItem) => {
        const normalizedBarcodes = normalizeBarcodes(barcodeInput);

        const itemData = toFoodInput(data, getCurrentTimestamp());

        if (editingItem) {
            updateFoodInDictionary({ ...editingItem, ...itemData });
            toast.success('食品を更新しました');
        } else {
            addFoodToDictionary({ id: generateId(), ...itemData });
            toast.success('食品を追加しました');
        }

        if (normalizedBarcodes.length > 0) {
            try {
                await saveBarcodeMappingRequest(normalizedBarcodes, itemData);
                toast.success(`バーコード情報を${normalizedBarcodes.length}件保存しました`);
                const foodKey = buildFoodMatchKey(itemData);
                setBarcodeMappingsByFoodKey((prev) => ({
                    ...prev,
                    [foodKey]: Array.from(new Set([...(prev[foodKey] ?? []), ...normalizedBarcodes])),
                }));
            } catch (error) {
                toast.fromError('バーコード情報の保存に失敗しました', error);
            }
        }

        cancelEdit();
    };

    const handleBarcodeScanSuccess = (code: string) => {
        setBarcodeInput(code);
        setIsScannerOpen(false);
        toast.success(`バーコードを読み取りました: ${code}`);
    };

    const handleDelete = (id: string, name: string) => {
        if (confirm(`「${name}」を削除してもよろしいですか？`)) {
            deleteFoodFromDictionary(id);
        }
    };

    const handleToggleFavorite = (id: string) => {
        toggleFavoriteFood(id);
    };

    const handleAddLog = async (food: FoodItem) => {
        const { id: _id, ...rest } = food;
        void _id;
        try {
            await addFoodItem({
                ...rest,
                timestamp: getSelectedTimestamp(),
            });
            toast.success(food.name + 'を食事記録に追加しました');
        } catch {
            // addFoodItem 側でエラートーストを表示済み
        }
    };

    const toggleFoodSelection = (foodId: string) => {
        setSelectedFoodIds((prev) =>
            prev.includes(foodId) ? prev.filter((id) => id !== foodId) : [...prev, foodId],
        );
    };

    const cancelSelection = () => {
        setIsSelecting(false);
        setSelectedFoodIds([]);
        setBulkStoreName('');
        setBulkGroupName('');
    };

    const startSelection = () => {
        setIsSelecting(true);
        setSelectedFoodIds([]);
        setBulkStoreName('');
        setBulkGroupName('');
    };

    const applyBulkUpdate = () => {
        if (selectedFoodIds.length === 0) return;

        const selectedSet = new Set(selectedFoodIds);
        const nextStore = bulkStoreName.trim() || undefined;
        const nextGroup = bulkGroupName.trim() || undefined;

        // 選択された食品を1件ずつ更新する（各 PATCH /api/foods/[id]）。
        for (const food of foods) {
            if (!selectedSet.has(food.id)) continue;
            void updateFoodInDictionary({
                ...food,
                store: nextStore,
                storeGroup: nextGroup,
                timestamp: getCurrentTimestamp(),
            });
        }

        toast.success('選択した食品の店舗とグループを更新しました');
        cancelSelection();
    };

    const getStoreGroupKey = (storeName: string, groupName: string) => `${storeName}::${groupName}`;

    const toggleStoreCollapsed = (storeName: string) => {
        setCollapsedStores((prev) =>
            prev.includes(storeName) ? prev.filter((name) => name !== storeName) : [...prev, storeName],
        );
    };

    const toggleStoreGroupCollapsed = (storeName: string, groupName: string) => {
        const groupKey = getStoreGroupKey(storeName, groupName);
        setCollapsedGroups((prev) =>
            prev.includes(groupKey) ? prev.filter((key) => key !== groupKey) : [...prev, groupKey],
        );
    };

    const filteredFoods = useMemo(
        () => foods.filter((food) => food.name.toLowerCase().includes(searchQuery.toLowerCase())),
        [foods, searchQuery],
    );

    const sections = useMemo(() => buildStoreSections(filteredFoods), [filteredFoods]);

    return (
        <div className="space-y-6 pb-28">
            <PageTitle>食品データ管理</PageTitle>

            <div className="px-4">
                {isAdding ? (
                    <Card>
                        <CardContent className="pt-6">
                            <h2 className="mb-4 text-lg font-semibold">{editingItem ? '食品を編集' : '新規食品を追加'}</h2>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>食品名</Label>
                                    <Input {...register('name', { required: true })} placeholder="例: ハンバーグ" />
                                </div>
                                <PfcMacroInputs register={register} step="0.1" />
                                <DatalistInput
                                    register={register}
                                    name="store"
                                    label="店名 / ブランド (任意)"
                                    listId="store-suggestions"
                                    options={uniqueStores}
                                    placeholder="例: セブンイレブン"
                                />
                                <DatalistInput
                                    register={register}
                                    name="storeGroup"
                                    label="店内グループ (任意)"
                                    listId="store-group-suggestions"
                                    options={uniqueStoreGroups}
                                    placeholder="例: おにぎり"
                                />
                                <div className="space-y-2">
                                    <Label htmlFor="barcode">バーコード (任意・複数可)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="barcode"
                                            value={barcodeInput}
                                            onChange={(event) => setBarcodeInput(event.target.value)}
                                            placeholder="例: 4901234567890"
                                        />
                                        <Button type="button" variant="outline" onClick={() => setIsScannerOpen(true)}>
                                            <ScanBarcode className="mr-2 h-4 w-4" />
                                            スキャン
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        カンマ・読点・空白区切りで複数バーコードを同時に紐づけできます。
                                    </p>
                                </div>

                                <div className="flex gap-2 pt-4">
                                    <Button type="button" variant="outline" className="flex-1" onClick={cancelEdit}>
                                        <X className="mr-2 h-4 w-4" /> キャンセル
                                    </Button>
                                    <Button type="submit" className="flex-1">
                                        <Save className="mr-2 h-4 w-4" /> 保存
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <EatDateTimeCard
                            eatDate={eatDate}
                            setEatDate={setEatDate}
                            eatTime={eatTime}
                            setEatTime={setEatTime}
                        />

                        <div className="sticky top-0 z-20 -mx-4 space-y-2 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                            <div className="flex gap-2">
                                {!isSelecting && (
                                    <Button variant="outline" onClick={startSelection}>
                                        店舗/グループ変更
                                    </Button>
                                )}
                                <Button onClick={startAdd} aria-label="新規追加">
                                    +
                                </Button>
                            </div>
                            <div className="relative">
                                <Input
                                    placeholder="食品を検索..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            {filteredFoods.length === 0 ? (
                                <p>食品が見つかりません</p>
                            ) : (
                                sections.map((section) => (
                                    <div key={section.storeName} className="pb-4">
                                        <button
                                            type="button"
                                            className="mb-2 flex w-full items-center rounded bg-muted/30 px-2 py-1 text-left text-sm font-semibold text-muted-foreground"
                                            onClick={() => toggleStoreCollapsed(section.storeName)}
                                        >
                                            {collapsedStores.includes(section.storeName) ? (
                                                <ChevronRight className="mr-1 h-4 w-4" />
                                            ) : (
                                                <ChevronDown className="mr-1 h-4 w-4" />
                                            )}
                                            {section.storeName}
                                        </button>

                                        {collapsedStores.includes(section.storeName) && null}

                                        {!collapsedStores.includes(section.storeName) && (
                                            <div className="space-y-3">
                                                {section.groups.map((group) => {
                                                    const groupKey = getStoreGroupKey(section.storeName, group.groupName);
                                                    const isGroupCollapsed = collapsedGroups.includes(groupKey);

                                                    return (
                                                        <div
                                                            key={`${section.storeName}-${group.groupName}`}
                                                            className="space-y-2 rounded-md border bg-background p-2"
                                                        >
                                                            <button
                                                                type="button"
                                                                className="flex w-full items-center px-1 text-left text-xs font-medium text-muted-foreground"
                                                                onClick={() => toggleStoreGroupCollapsed(section.storeName, group.groupName)}
                                                            >
                                                                {isGroupCollapsed ? (
                                                                    <ChevronRight className="mr-1 h-3.5 w-3.5" />
                                                                ) : (
                                                                    <ChevronDown className="mr-1 h-3.5 w-3.5" />
                                                                )}
                                                                {group.groupName}
                                                            </button>

                                                            {!isGroupCollapsed && (
                                                                <div className="space-y-2">
                                                                    {group.foods.map((food) => {
                                                                        const isSelected = selectedFoodIds.includes(food.id);

                                                                        return (
                                                                            <div
                                                                                key={food.id}
                                                                                className={`flex items-center justify-between gap-2 rounded-lg border p-3 ${
                                                                                    isSelected
                                                                                        ? 'border-primary bg-primary/5'
                                                                                        : 'bg-card'
                                                                                }`}
                                                                                onClick={() => {
                                                                                    if (!isSelecting) return;
                                                                                    toggleFoodSelection(food.id);
                                                                                }}
                                                                            >
                                                                                {isSelecting && (
                                                                                    <Checkbox
                                                                                        checked={isSelected}
                                                                                        onCheckedChange={() => toggleFoodSelection(food.id)}
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                        aria-label={`${food.name}を選択`}
                                                                                    />
                                                                                )}
                                                                                <div className="flex-1 pr-2">
                                                                                    <div className="font-medium">{food.name}</div>
                                                                                    <PfcMacroLine food={food} />
                                                                                    {(barcodeMappingsByFoodKey[buildFoodMatchKey(food)] ?? []).length > 0 && (
                                                                                        <div className="text-xs text-muted-foreground">
                                                                                            バーコード: {(barcodeMappingsByFoodKey[buildFoodMatchKey(food)] ?? []).join(', ')}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                {!isSelecting ? (
                                                                                    <div className="flex gap-1">
                                                                                        <IconButton onClick={() => handleAddLog(food)}>
                                                                                            <Plus className="h-4 w-4" />
                                                                                        </IconButton>
                                                                                        <IconButton onClick={() => handleToggleFavorite(food.id)}>
                                                                                            <Star
                                                                                                className={`h-4 w-4 ${
                                                                                                    isFavoriteFood(food.id)
                                                                                                        ? 'fill-yellow-400 text-yellow-400'
                                                                                                        : 'text-muted-foreground'
                                                                                                }`}
                                                                                            />
                                                                                        </IconButton>
                                                                                        <IconButton onClick={() => startEdit(food)}>
                                                                                            <Pencil className="h-4 w-4 text-muted-foreground" />
                                                                                        </IconButton>
                                                                                        <IconButton onClick={() => handleDelete(food.id, food.name)}>
                                                                                            <Trash className="h-4 w-4 text-destructive" />
                                                                                        </IconButton>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-xs text-primary">
                                                                                        {isSelected ? '選択中' : 'タップで選択'}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {isScannerOpen && (
                <BarcodeScanner onScanSuccess={handleBarcodeScanSuccess} onClose={() => setIsScannerOpen(false)} />
            )}

            {isSelecting && (
                <div className="fixed inset-x-0 bottom-16 z-50 px-4">
                    <Card>
                        <CardContent className="space-y-3 pt-4">
                            <p className="text-sm font-medium">{selectedFoodIds.length}件を選択中</p>
                            <div className="space-y-1">
                                <Label className="text-xs">店舗（未入力でその他）</Label>
                                <Input
                                    value={bulkStoreName}
                                    onChange={(e) => setBulkStoreName(e.target.value)}
                                    placeholder="店舗名を入力"
                                    list="store-suggestions"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">店内グループ（未入力で未分類）</Label>
                                <Input
                                    value={bulkGroupName}
                                    onChange={(e) => setBulkGroupName(e.target.value)}
                                    placeholder="グループ名を入力"
                                    list="store-group-suggestions"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={cancelSelection}>
                                    キャンセル
                                </Button>
                                <Button className="flex-1" onClick={applyBulkUpdate} disabled={selectedFoodIds.length === 0}>
                                    保存
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
