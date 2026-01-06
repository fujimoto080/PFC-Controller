'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Camera, Search, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    addFoodItem,
    getFoodDictionary,
    getHistoryItems,
    addFoodToDictionary,
    getUniqueStores,
} from '@/lib/storage';
import { FoodItem } from '@/lib/types';
import { toast } from 'sonner';

export function AddFoodForm() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('manual');
    const [searchQuery, setSearchQuery] = useState('');
    const [publicFoods, setPublicFoods] = useState<FoodItem[]>([]);
    const [historyFoods, setHistoryFoods] = useState<FoodItem[]>([]);
    const [saveToDictionary, setSaveToDictionary] = useState(false);
    const [uniqueStores, setUniqueStores] = useState<string[]>([]);

    const now = new Date();
    const initialDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const initialTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const [eatDate, setEatDate] = useState(initialDate);
    const [eatTime, setEatTime] = useState(initialTime);

    const getSelectedTimestamp = () => {
        const [year, month, day] = eatDate.split('-').map(Number);
        const [hour, minute] = eatTime.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute).getTime();
    };

    useEffect(() => {
        setPublicFoods(getFoodDictionary());
        setHistoryFoods(getHistoryItems());
        setUniqueStores(getUniqueStores());
    }, [activeTab]); // Reload when tab changes in case data was updated externally

    // Form for manual entry
    const { register, handleSubmit, reset } = useForm<FoodItem>();

    const onSubmitManual = (data: any) => {
        // Basic validation / conversion
        const item: FoodItem = {
            id: Date.now().toString(),
            name: data.name,
            protein: Number(data.protein),
            fat: Number(data.fat),
            carbs: Number(data.carbs),
            calories: Number(data.calories),
            store: data.store || undefined,
            timestamp: getSelectedTimestamp(),
        };

        addFoodItem(item);
        if (saveToDictionary) {
            addFoodToDictionary(item);
            toast.success('食品リストにも保存しました');
        }
        toast.success(item.name + 'を追加しました');
        reset();
        setSaveToDictionary(false);
        router.push('/');
    };

    const loadFromHistory = (item: FoodItem) => {
        reset({
            name: item.name,
            protein: item.protein,
            fat: item.fat,
            carbs: item.carbs,
            calories: item.calories,
            store: item.store,
        });
        setActiveTab('manual');
        toast.info('履歴から入力フォームに読み込みました。必要に応じて編集・保存してください。');
    };

    const handleAddPublic = (food: any) => {
        const item: FoodItem = {
            ...food,
            id: Date.now().toString(), // unique id for log
            timestamp: getSelectedTimestamp(),
        };
        addFoodItem(item);
        toast.success(item.name + 'を追加しました');
        router.push('/');
    };

    const filteredFoods = publicFoods.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    return (
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

            <Tabs defaultValue="manual" onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="manual">手動</TabsTrigger>
                    <TabsTrigger value="search">検索</TabsTrigger>
                    <TabsTrigger value="history">履歴</TabsTrigger>
                    <TabsTrigger value="photo">写真</TabsTrigger>
                </TabsList>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        <TabsContent value="manual" className="mt-4">
                            <Card>
                                <CardContent className="pt-6">
                                    <form
                                        onSubmit={handleSubmit(onSubmitManual)}
                                        className="space-y-4"
                                    >
                                        <div className="space-y-2">
                                            <Label>食品名</Label>
                                            <Input
                                                {...register('name', { required: true })}
                                                placeholder="例: ランチセット"
                                            />
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
                                            <Label htmlFor="store">店名 / ブランド (任意)</Label>
                                            <Input
                                                id="store"
                                                {...register('store')}
                                                placeholder="例: セブンイレブン"
                                                list="store-suggestions"
                                            />
                                            <datalist id="store-suggestions">
                                                {uniqueStores.map((store) => (
                                                    <option key={store} value={store} />
                                                ))}
                                            </datalist>
                                        </div>
                                        <div className="flex items-center space-x-2 pt-2">
                                            <Checkbox
                                                id="saveToDict"
                                                checked={saveToDictionary}
                                                onCheckedChange={(checked) =>
                                                    setSaveToDictionary(checked as boolean)
                                                }
                                            />
                                            <Label
                                                htmlFor="saveToDict"
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                入力を食品リストにも保存する
                                            </Label>
                                        </div>
                                        <Button type="submit" className="w-full">
                                            <Plus className="mr-2 h-4 w-4" /> 記録を追加
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="search" className="mt-4">
                            <Card>
                                <CardContent className="space-y-4 pt-6">
                                    <div className="flex justify-end items-center mb-2">
                                        <Button variant="outline" size="sm" asChild>
                                            <a href="/manage-foods">
                                                管理 / 追加
                                            </a>
                                        </Button>
                                    </div>
                                    <div className="relative">
                                        <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
                                        <Input
                                            type="search"
                                            placeholder="食品を検索..."
                                            className="pl-8"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="h-[calc(100vh-320px)] space-y-4 overflow-y-auto">
                                        {Object.entries(
                                            filteredFoods.reduce((acc, food) => {
                                                const store = food.store || 'その他';
                                                if (!acc[store]) acc[store] = [];
                                                acc[store].push(food);
                                                return acc;
                                            }, {} as Record<string, typeof filteredFoods>),
                                        ).map(([store, foods]) => (
                                            <div key={store}>
                                                <h3 className="mb-2 text-sm font-semibold text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                                                    {store}
                                                </h3>
                                                <div className="space-y-2">
                                                    {foods.map((food) => (
                                                        <div
                                                            key={food.id}
                                                            className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
                                                            role="button"
                                                            onClick={() => handleAddPublic(food)}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                {food.image ? (
                                                                    <img
                                                                        src={food.image}
                                                                        alt={food.name}
                                                                        className="h-10 w-10 rounded-md object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                                                                        <span className="text-xs">No img</span>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div className="font-medium">{food.name}</div>
                                                                    <div className="text-muted-foreground text-xs">
                                                                        P:{food.protein} F:{food.fat} C:{food.carbs} |{' '}
                                                                        {food.calories}kcal
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Button size="icon" variant="ghost">
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        {filteredFoods.length === 0 && (
                                            <div className="text-muted-foreground py-4 text-center text-sm">
                                                食品が見つかりません。
                                                <br />
                                                <a href="/manage-foods" className="text-primary underline mt-2 inline-block">
                                                    新しい食品を登録する
                                                </a>
                                            </div>
                                        )}
                                        <div className="pt-2 text-center" />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="history" className="mt-4">
                            <Card>
                                <CardContent className="space-y-4 pt-6">
                                    <div className="max-h-[300px] space-y-4 overflow-y-auto">
                                        {historyFoods.length === 0 ? (
                                            <div className="text-muted-foreground py-4 text-center text-sm">
                                                履歴がありません。
                                            </div>
                                        ) : (
                                            historyFoods.map((item, i) => (
                                                <div
                                                    key={i}
                                                    className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
                                                    role="button"
                                                    onClick={() => loadFromHistory(item)}
                                                >
                                                    <div>
                                                        <div className="font-medium">{item.name}</div>
                                                        <div className="text-muted-foreground text-xs">
                                                            P:{item.protein} F:{item.fat} C:{item.carbs} |{' '}
                                                            {item.calories}kcal
                                                        </div>
                                                    </div>
                                                    <Button size="sm" variant="outline">
                                                        呼び出し
                                                    </Button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground text-center">
                                        タップして手動入力フォームに読み込みます。
                                        <br />
                                        そこで「食品リストにも保存」にチェックを入れると、リストに登録できます。
                                    </p>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="photo" className="mt-4">
                            <Card>
                                <CardContent className="space-y-4 pt-6 text-center">
                                    <div className="text-muted-foreground group relative flex flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-10">
                                        <Camera className="mb-2 h-10 w-10 transition-transform group-hover:scale-110" />
                                        <p>写真を撮る</p>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="absolute inset-0 cursor-pointer opacity-0"
                                        />
                                    </div>
                                    <p className="text-muted-foreground text-xs">
                                        注: 写真分析は現在AI
                                        APIに接続されていません。手動入力または検索を使用してください。
                                    </p>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </motion.div>
                </AnimatePresence>
            </Tabs>
        </div >
    );
}
