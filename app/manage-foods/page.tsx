'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Pencil, Trash, Save, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
    getFoodDictionary,
    addFoodToDictionary,
    updateFoodInDictionary,
    deleteFoodFromDictionary,
    getUniqueStores,
} from '@/lib/storage';
import { FoodItem } from '@/lib/types';

const getCurrentTimestamp = () => Date.now();
const generateId = () => Date.now().toString();

export default function ManageFoodsPage() {
    const router = useRouter();
    const [foods, setFoods] = useState<FoodItem[]>(() => getFoodDictionary());
    const [searchQuery, setSearchQuery] = useState('');
    const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [uniqueStores] = useState<string[]>(() => getUniqueStores());

    // Form handling
    const { register, handleSubmit, reset, setValue } = useForm<FoodItem>();


    const refreshFoods = () => {
        setFoods(getFoodDictionary());
    };

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

        refreshFoods();
        cancelEdit();
    };

    const handleDelete = (id: string, name: string) => {
        if (confirm(`「${name}」を削除してもよろしいですか？`)) {
            deleteFoodFromDictionary(id);
            toast.success('食品を削除しました');
            refreshFoods();
        }
    };

    const filteredFoods = foods.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 pb-20">
            <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-b">
                <div className="flex items-center gap-4 px-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-xl font-bold">食品データ管理</h1>
                </div>
            </header>

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

                        <div className="space-y-2">
                            {filteredFoods.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">食品が見つかりません</p>
                            ) : (
                                filteredFoods.map((food) => (
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
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => startEdit(food)}
                                            >
                                                <Pencil className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(food.id, food.name)}
                                            >
                                                <Trash className="h-4 w-4 text-destructive" />
                                            </Button>
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
