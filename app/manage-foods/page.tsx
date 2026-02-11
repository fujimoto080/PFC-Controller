'use client';

import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash, Save, X, Star } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
    addFoodToDictionary,
    updateFoodInDictionary,
    deleteFoodFromDictionary,
    toggleFavoriteFood,
    isFavoriteFood,
    addFoodItem,
} from '@/lib/storage';
import { FoodItem } from '@/lib/types';
import { generateId } from '@/lib/utils';
import { useFoodDictionary } from '@/hooks/use-food-dictionary';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import { PageTitle } from '@/components/ui/page-title';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const getCurrentTimestamp = () => Date.now();

type SortOption = 'name-asc' | 'name-desc' | 'calories-desc' | 'protein-desc' | 'latest';
type GroupOption = 'none' | 'store' | 'favorite';

const sortOptionLabels: Record<SortOption, string> = {
    'name-asc': '名前順 (A→Z)',
    'name-desc': '名前順 (Z→A)',
    'calories-desc': 'カロリーが高い順',
    'protein-desc': 'タンパク質が多い順',
    latest: '更新が新しい順',
};

const groupOptionLabels: Record<GroupOption, string> = {
    none: 'グループなし',
    store: '店名 / ブランド',
    favorite: 'お気に入り',
};

const sortFoods = (foods: FoodItem[], sortOption: SortOption) => {
    const sortedFoods = [...foods];
    const collator = new Intl.Collator('ja');

    sortedFoods.sort((a, b) => {
        switch (sortOption) {
            case 'name-asc':
                return collator.compare(a.name, b.name);
            case 'name-desc':
                return collator.compare(b.name, a.name);
            case 'calories-desc':
                return b.calories - a.calories;
            case 'protein-desc':
                return b.protein - a.protein;
            case 'latest':
                return (b.timestamp ?? 0) - (a.timestamp ?? 0);
            default:
                return 0;
        }
    });

    return sortedFoods;
};

const getGroupName = (food: FoodItem, groupOption: GroupOption) => {
    if (groupOption === 'none') return '全ての食品';
    if (groupOption === 'favorite') return isFavoriteFood(food.id) ? 'お気に入り' : '通常';
    return food.store || 'その他';
};

export default function ManageFoodsPage() {
    const { foods, uniqueStores } = useFoodDictionary();
    const [searchQuery, setSearchQuery] = useState('');
    const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [sortOption, setSortOption] = useState<SortOption>('name-asc');
    const [groupOption, setGroupOption] = useState<GroupOption>('store');

    const { eatDate, setEatDate, eatTime, setEatTime, getSelectedTimestamp } = useEatDateTime();

    // Form handling
    const { register, handleSubmit, reset, setValue } = useForm<FoodItem>();

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
        });
    };

    const startEdit = (item: FoodItem) => {
        setEditingItem(item);
        setIsAdding(true);
        // Set form values
        setValue('name', item.name);
        setValue('protein', item.protein);
        setValue('fat', item.fat);
        setValue('carbs', item.carbs);
        setValue('calories', item.calories);
        setValue('store', item.store);
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
            timestamp: getCurrentTimestamp(),
        };

        if (editingItem) {
            // Update
            const updated: FoodItem = {
                ...editingItem,
                ...itemData,
            };
            updateFoodInDictionary(updated);
            toast.success('食品を更新しました');
        } else {
            // Create
            const newItem: FoodItem = {
                id: generateId(),
                ...itemData,
            };
            addFoodToDictionary(newItem);
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
        const item: FoodItem = {
            ...food,
            id: generateId(),
            timestamp: getSelectedTimestamp(),
        };
        addFoodItem(item);
        toast.success(item.name + 'を食事記録に追加しました');
    };

    const filteredFoods = useMemo(
        () => foods.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())),
        [foods, searchQuery],
    );

    const groupedFoods = useMemo(() => {
        return Object.entries(
            sortFoods(filteredFoods, sortOption).reduce((acc, food) => {
                const groupName = getGroupName(food, groupOption);
                if (!acc[groupName]) acc[groupName] = [];
                acc[groupName].push(food);
                return acc;
            }, {} as Record<string, FoodItem[]>),
        );
    }, [filteredFoods, groupOption, sortOption]);

    return (
        <div className="space-y-6 pb-20">
            <PageTitle>食品データ管理</PageTitle>

            <div className="px-4">
                {isAdding ? (
                    <Card>
                        <CardContent className="pt-6">
                            <h2 className="text-lg font-semibold mb-4">
                                {editingItem ? '食品を編集' : '新規食品を追加'}
                            </h2>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>食品名</Label>
                                    <Input {...register('name', { required: true })} placeholder="例: ハンバーグ" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>タンパク質 (g)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            {...register('protein')}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>脂質 (g)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            {...register('fat')}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>炭水化物 (g)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            {...register('carbs')}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>カロリー</Label>
                                        <Input
                                            type="number"
                                            {...register('calories')}
                                            placeholder="0"
                                        />
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
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    placeholder="食品を検索..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Button onClick={startAdd}>
                                <Plus className="h-4 w-4" /> 新規
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                                <Label>並び替え</Label>
                                <Select
                                    value={sortOption}
                                    onValueChange={(value) => setSortOption(value as SortOption)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(sortOptionLabels).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>グルーピング</Label>
                                <Select
                                    value={groupOption}
                                    onValueChange={(value) => setGroupOption(value as GroupOption)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(groupOptionLabels).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {filteredFoods.length === 0 ? (
                                <p>食品が見つかりません</p>
                            ) : (
                                groupedFoods.map(([groupName, foods]) => (
                                    <div key={groupName} className="pb-4">
                                        <h3 className="mb-2 text-sm font-semibold text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                                            {groupName}
                                        </h3>
                                        <div className="space-y-2">
                                            {foods.map((food) => (
                                                <div
                                                    key={food.id}
                                                    className="flex items-center justify-between rounded-lg border p-3 bg-card"
                                                >
                                                    <div>
                                                        <div className="font-medium">{food.name}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            P:{food.protein} F:{food.fat} C:{food.carbs} | {food.calories}kcal
                                                            {food.store && ` • ${food.store}`}
                                                        </div>
                                                    </div>
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
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>


        </div>
    );
}
