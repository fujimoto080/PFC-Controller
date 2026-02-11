'use client';

import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash, Save, X, Star } from 'lucide-react';
import { Reorder } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

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
    toggleFavoriteFood,
    isFavoriteFood,
    addFoodItem,
    saveFoodDictionary,
} from '@/lib/storage';
import { FoodItem } from '@/lib/types';
import { generateId } from '@/lib/utils';
import { useFoodDictionary } from '@/hooks/use-food-dictionary';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import { PageTitle } from '@/components/ui/page-title';

const getCurrentTimestamp = () => Date.now();

type StoreGroupSection = {
    storeName: string;
    groups: {
        groupName: string;
        foods: FoodItem[];
    }[];
};

const getStoreName = (food: FoodItem) => food.store || 'その他';
const getStoreGroupName = (food: FoodItem) => food.storeGroup || '未分類';

const buildStoreSections = (foods: FoodItem[]): StoreGroupSection[] => {
    const sections: StoreGroupSection[] = [];

    foods.forEach((food) => {
        const storeName = getStoreName(food);
        const groupName = getStoreGroupName(food);

        let storeSection = sections.find((section) => section.storeName === storeName);
        if (!storeSection) {
            storeSection = { storeName, groups: [] };
            sections.push(storeSection);
        }

        let groupSection = storeSection.groups.find((group) => group.groupName === groupName);
        if (!groupSection) {
            groupSection = { groupName, foods: [] };
            storeSection.groups.push(groupSection);
        }

        groupSection.foods.push(food);
    });

    return sections;
};

const reorderWithinSubset = (foods: FoodItem[], targetIds: string[]) => {
    const targetSet = new Set(targetIds);
    const orderedFoods = targetIds
        .map((id) => foods.find((food) => food.id === id))
        .filter((food): food is FoodItem => !!food);
    let index = 0;

    return foods.map((food) => {
        if (!targetSet.has(food.id)) return food;
        const next = orderedFoods[index];
        index += 1;
        return next;
    });
};

export default function ManageFoodsPage() {
    const { foods, uniqueStores } = useFoodDictionary();
    const [searchQuery, setSearchQuery] = useState('');
    const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([]);
    const [bulkStoreName, setBulkStoreName] = useState('');
    const [bulkGroupName, setBulkGroupName] = useState('');
    const [isSortLocked, setIsSortLocked] = useState(false);
    const [draggingFoodId, setDraggingFoodId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<{ storeName: string; groupName: string } | null>(null);

    const { eatDate, setEatDate, eatTime, setEatTime, getSelectedTimestamp } = useEatDateTime();

    const { register, handleSubmit, reset, setValue } = useForm<FoodItem>();

    const uniqueStoreGroups = useMemo(
        () => Array.from(new Set(foods.map((food) => food.storeGroup).filter(Boolean) as string[])).sort(),
        [foods],
    );

    const startAdd = () => {
        setEditingItem(null);
        setIsAdding(true);
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
        reset();
    };

    const onSubmit = (data: FoodItem) => {
        const itemData = {
            name: data.name,
            protein: Number(data.protein),
            fat: Number(data.fat),
            carbs: Number(data.carbs),
            calories: Number(data.calories),
            store: data.store || undefined,
            storeGroup: data.storeGroup || undefined,
            timestamp: getCurrentTimestamp(),
        };

        if (editingItem) {
            updateFoodInDictionary({ ...editingItem, ...itemData });
            toast.success('食品を更新しました');
        } else {
            addFoodToDictionary({ id: generateId(), ...itemData });
            toast.success('食品を追加しました');
        }

        cancelEdit();
    };

    const handleDelete = (id: string, name: string) => {
        if (confirm(`「${name}」を削除してもよろしいですか？`)) {
            deleteFoodFromDictionary(id);
        }
    };

    const handleToggleFavorite = (id: string) => {
        toggleFavoriteFood(id);
    };

    const handleAddLog = (food: FoodItem) => {
        addFoodItem({
            ...food,
            id: generateId(),
            timestamp: getSelectedTimestamp(),
        });
        toast.success(food.name + 'を食事記録に追加しました');
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

        const updatedFoods = foods.map((food) =>
            selectedSet.has(food.id)
                ? {
                      ...food,
                      store: nextStore,
                      storeGroup: nextGroup,
                      timestamp: getCurrentTimestamp(),
                  }
                : food,
        );

        saveFoodDictionary(updatedFoods);
        toast.success('選択した食品の店舗とグループを更新しました');
        cancelSelection();
    };

    const handleFoodReorder = (storeName: string, groupName: string, reorderedIds: string[]) => {
        if (searchQuery.trim()) return;

        const targetIds = foods
            .filter((food) => getStoreName(food) === storeName && getStoreGroupName(food) === groupName)
            .map((food) => food.id);

        if (targetIds.length <= 1) return;
        const nextFoods = reorderWithinSubset(foods, reorderedIds);
        saveFoodDictionary(nextFoods);
    };

    const handleGroupReorder = (storeName: string, reorderedGroupNames: string[]) => {
        if (searchQuery.trim()) return;

        const storeFoods = foods.filter((food) => getStoreName(food) === storeName);
        if (storeFoods.length <= 1) return;

        const groupMap = new Map<string, FoodItem[]>();
        storeFoods.forEach((food) => {
            const groupName = getStoreGroupName(food);
            const groupFoods = groupMap.get(groupName) || [];
            groupFoods.push(food);
            groupMap.set(groupName, groupFoods);
        });

        const reorderedStoreFoods = reorderedGroupNames.flatMap((groupName) => groupMap.get(groupName) || []);
        const storeFoodIds = new Set(storeFoods.map((food) => food.id));
        let index = 0;

        const nextFoods = foods.map((food) => {
            if (!storeFoodIds.has(food.id)) return food;
            const nextFood = reorderedStoreFoods[index];
            index += 1;
            return nextFood;
        });

        saveFoodDictionary(nextFoods);
    };

    const moveFoodToStoreGroup = (foodId: string, targetStoreName: string, targetGroupName: string) => {
        const movingFood = foods.find((food) => food.id === foodId);
        if (!movingFood) return;

        if (getStoreName(movingFood) === targetStoreName && getStoreGroupName(movingFood) === targetGroupName) return;

        const nextMovedFood: FoodItem = {
            ...movingFood,
            store: targetStoreName === 'その他' ? undefined : targetStoreName,
            storeGroup: targetGroupName === '未分類' ? undefined : targetGroupName,
            timestamp: getCurrentTimestamp(),
        };

        const remainingFoods = foods.filter((food) => food.id !== foodId);
        const targetGroupLastIndex = remainingFoods.reduce(
            (lastIndex, food, index) =>
                getStoreName(food) === targetStoreName && getStoreGroupName(food) === targetGroupName ? index : lastIndex,
            -1,
        );

        if (targetGroupLastIndex >= 0) {
            const nextFoods = [...remainingFoods];
            nextFoods.splice(targetGroupLastIndex + 1, 0, nextMovedFood);
            saveFoodDictionary(nextFoods);
            return;
        }

        const targetStoreLastIndex = remainingFoods.reduce(
            (lastIndex, food, index) => (getStoreName(food) === targetStoreName ? index : lastIndex),
            -1,
        );

        if (targetStoreLastIndex >= 0) {
            const nextFoods = [...remainingFoods];
            nextFoods.splice(targetStoreLastIndex + 1, 0, nextMovedFood);
            saveFoodDictionary(nextFoods);
            return;
        }

        saveFoodDictionary([...remainingFoods, nextMovedFood]);
    };

    const filteredFoods = useMemo(
        () => foods.filter((food) => food.name.toLowerCase().includes(searchQuery.toLowerCase())),
        [foods, searchQuery],
    );

    const sections = useMemo(() => buildStoreSections(filteredFoods), [filteredFoods]);
    const disableDnD = isSortLocked || isSelecting || !!searchQuery.trim();

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
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>タンパク質 (g)</Label>
                                        <Input type="number" step="0.1" {...register('protein')} placeholder="0" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>脂質 (g)</Label>
                                        <Input type="number" step="0.1" {...register('fat')} placeholder="0" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>炭水化物 (g)</Label>
                                        <Input type="number" step="0.1" {...register('carbs')} placeholder="0" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>カロリー</Label>
                                        <Input type="number" {...register('calories')} placeholder="0" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>店名 / ブランド (任意)</Label>
                                    <Input {...register('store')} placeholder="例: セブンイレブン" list="store-suggestions" />
                                    <datalist id="store-suggestions">
                                        {uniqueStores.map((store) => (
                                            <option key={store} value={store} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="space-y-2">
                                    <Label>店内グループ (任意)</Label>
                                    <Input {...register('storeGroup')} placeholder="例: おにぎり" list="store-group-suggestions" />
                                    <datalist id="store-group-suggestions">
                                        {uniqueStoreGroups.map((group) => (
                                            <option key={group} value={group} />
                                        ))}
                                    </datalist>
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
                        <Card className="bg-muted/30">
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="eatDate">食べた日付</Label>
                                        <Input
                                            id="eatDate"
                                            type="date"
                                            value={eatDate}
                                            onChange={(e) => setEatDate(e.target.value)}
                                            onClick={(e) => e.currentTarget.showPicker?.()}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="eatTime">時刻</Label>
                                        <Input
                                            id="eatTime"
                                            type="time"
                                            value={eatTime}
                                            onChange={(e) => setEatTime(e.target.value)}
                                            onClick={(e) => e.currentTarget.showPicker?.()}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="sticky top-0 z-20 -mx-4 space-y-2 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                            <div className="flex gap-2">
                                {!isSelecting && (
                                    <Button variant="outline" onClick={startSelection}>
                                        店舗/グループ変更
                                    </Button>
                                )}
                                <Button
                                    variant={isSortLocked ? 'default' : 'outline'}
                                    onClick={() => setIsSortLocked((prev) => !prev)}
                                    aria-pressed={isSortLocked}
                                >
                                    並び替え
                                </Button>
                                <Button onClick={startAdd}>
                                    <Plus className="h-4 w-4" /> 新規
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

                        {isSortLocked && (
                            <p className="text-xs text-muted-foreground">並び替えを無効化中です。</p>
                        )}

                        {searchQuery.trim() && (
                            <p className="text-xs text-muted-foreground">検索中はドラッグ並び替えを無効化しています。</p>
                        )}

                        <div className="space-y-2">
                            {filteredFoods.length === 0 ? (
                                <p>食品が見つかりません</p>
                            ) : (
                                sections.map((section) => (
                                    <div key={section.storeName} className="pb-4">
                                        <h3 className="mb-2 rounded bg-muted/30 px-2 py-1 text-sm font-semibold text-muted-foreground">
                                            {section.storeName}
                                        </h3>

                                        <Reorder.Group
                                            axis="y"
                                            values={section.groups.map((group) => group.groupName)}
                                            onReorder={(groupNames) => handleGroupReorder(section.storeName, groupNames)}
                                            className="space-y-3"
                                        >
                                            {section.groups.map((group) => (
                                                <Reorder.Item
                                                    key={`${section.storeName}-${group.groupName}`}
                                                    value={group.groupName}
                                                    drag={!disableDnD}
                                                    dragSnapToOrigin
                                                >
                                                    <div className="space-y-2 rounded-md border bg-background p-2">
                                                        <h4 className="px-1 text-xs font-medium text-muted-foreground">
                                                            {group.groupName}
                                                        </h4>

                                                        <Reorder.Group
                                                            axis="y"
                                                            values={group.foods.map((food) => food.id)}
                                                            onReorder={(ids) =>
                                                                handleFoodReorder(section.storeName, group.groupName, ids)
                                                            }
                                                            className="space-y-2"
                                                            onDragOver={(event) => {
                                                                if (disableDnD || !draggingFoodId) return;
                                                                event.preventDefault();
                                                                setDropTarget({
                                                                    storeName: section.storeName,
                                                                    groupName: group.groupName,
                                                                });
                                                            }}
                                                            onDragLeave={() => {
                                                                if (!dropTarget) return;
                                                                if (
                                                                    dropTarget.storeName === section.storeName &&
                                                                    dropTarget.groupName === group.groupName
                                                                ) {
                                                                    setDropTarget(null);
                                                                }
                                                            }}
                                                            onDrop={(event) => {
                                                                event.preventDefault();
                                                                if (!draggingFoodId || disableDnD) return;

                                                                moveFoodToStoreGroup(
                                                                    draggingFoodId,
                                                                    section.storeName,
                                                                    group.groupName,
                                                                );
                                                                setDraggingFoodId(null);
                                                                setDropTarget(null);
                                                            }}
                                                        >
                                                            {group.foods.map((food) => {
                                                                const isSelected = selectedFoodIds.includes(food.id);
                                                                const isDropTarget =
                                                                    dropTarget?.storeName === section.storeName &&
                                                                    dropTarget.groupName === group.groupName;

                                                                return (
                                                                    <Reorder.Item
                                                                        key={food.id}
                                                                        value={food.id}
                                                                        drag={!disableDnD}
                                                                        dragSnapToOrigin
                                                                        draggable={!disableDnD}
                                                                        onDragStart={() => setDraggingFoodId(food.id)}
                                                                        onDragEnd={() => {
                                                                            setDraggingFoodId(null);
                                                                            setDropTarget(null);
                                                                        }}
                                                                    >
                                                                        <div
                                                                            className={`flex items-center justify-between gap-2 rounded-lg border p-3 ${
                                                                                isSelected
                                                                                    ? 'border-primary bg-primary/5'
                                                                                    : isDropTarget
                                                                                      ? 'border-primary/60 bg-primary/10'
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
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    P:{food.protein} F:{food.fat} C:{food.carbs} | {food.calories}
                                                                                    kcal
                                                                                </div>
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
                                                                    </Reorder.Item>
                                                                );
                                                            })}
                                                        </Reorder.Group>
                                                    </div>
                                                </Reorder.Item>
                                            ))}
                                        </Reorder.Group>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

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
