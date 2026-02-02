'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Camera, Search, Plus, ScanBarcode } from 'lucide-react';
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
    addFoodToDictionary
} from '@/lib/storage';
import { FoodItem } from '@/lib/types';
import { generateId, formatDate } from '@/lib/utils';
import { useFoodDictionary } from '@/hooks/use-food-dictionary';
import { toast } from 'sonner';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { FoodListItem } from './FoodListItem';

export interface AddFoodFormProps {
    onSuccess?: () => void;
    initialData?: FoodItem;
}


export function AddFoodForm({ onSuccess, initialData }: AddFoodFormProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('manual');
    const [searchQuery, setSearchQuery] = useState('');
    const { foods: publicFoods, uniqueStores } = useFoodDictionary();
    const [saveToDictionary, setSaveToDictionary] = useState(false);
    const [showScanner, setShowScanner] = useState(false);

    const [eatDate, setEatDate] = useState('');
    const [eatTime, setEatTime] = useState('');

    useEffect(() => {
        // マウント時に日付と時刻を初期化（ハイドレーションエラーと同期的なsetStateの警告を回避）
        const now = new Date();
        const date = formatDate(now);
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        queueMicrotask(() => {
            if (!eatDate) setEatDate(date);
            if (!eatTime) setEatTime(time);
        });
    }, [eatDate, eatTime]); // マウント時に一度だけ実行

    const getSelectedTimestamp = () => {
        const [year, month, day] = eatDate.split('-').map(Number);
        const [hour, minute] = eatTime.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute).getTime();
    };


    // Form for manual entry
    const { register, handleSubmit, reset } = useForm<FoodItem>({
        defaultValues: initialData ? {
            name: initialData.name,
            protein: initialData.protein,
            fat: initialData.fat,
            carbs: initialData.carbs,
            calories: initialData.calories,
            store: initialData.store,
        } : undefined
    });

    const onSubmitManual = (data: FoodItem) => {
        // Basic validation / conversion
        const item: FoodItem = {
            id: generateId(),
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
        if (onSuccess) {
            onSuccess();
        } else {
            router.push('/');
        }
    };



    const handleAddPublic = (food: FoodItem) => {
        const item: FoodItem = {
            ...food,
            id: generateId(), // unique id for log
            timestamp: getSelectedTimestamp(),
        };
        addFoodItem(item);
        toast.success(item.name + 'を追加しました');
        if (onSuccess) {
            onSuccess();
        } else {
            router.push('/');
        }
    };

    const handleScanSuccess = async (code: string) => {
        setShowScanner(false);
        const loadingToast = toast.loading('商品情報を取得中...');

        try {
            const res = await fetch(`/api/barcode?code=${code}`);
            const data = await res.json();

            if (!res.ok) {
                toast.dismiss(loadingToast);
                toast.error(data.error || '商品が見つかりませんでした');
                return;
            }

            toast.dismiss(loadingToast);
            toast.success(`「${data.name}」が見つかりました`);

            // Switch to manual mode and fill form
            setActiveTab('manual');

            // We need to wait a tick for the tab switch to happen and form to mount/reset
            setTimeout(() => {
                reset({
                    name: data.name,
                    protein: data.protein,
                    fat: data.fat,
                    carbs: data.carbs,
                    calories: data.calories,
                    store: data.store
                });
            }, 100);

        } catch (error) {
            toast.dismiss(loadingToast);
            toast.error('エラーが発生しました');
            console.error(error);
        }
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
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="manual">手動</TabsTrigger>
                    <TabsTrigger value="search">検索</TabsTrigger>
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
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full gap-2"
                                            onClick={() => setShowScanner(true)}
                                        >
                                            <ScanBarcode className="h-4 w-4" />
                                            バーコードから読み取る
                                        </Button>
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
                                                        <FoodListItem
                                                            key={food.id}
                                                            food={food}
                                                            onAdd={handleAddPublic}
                                                        />
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
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>



                        <TabsContent value="photo" className="mt-4">
                            <Card>
                                <CardContent className="space-y-4 pt-6 text-center">
                                    <div className="text-muted-foreground group relative flex flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-10">
                                        <Camera className="mb-2 h-10 w-10 transition-transform group-hover:scale-110" />
                                        <p>写真を撮る</p>
                                        <Input
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

            {showScanner && (
                <BarcodeScanner
                    onScanSuccess={handleScanSuccess}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </div >
    );
}
