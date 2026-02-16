'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Camera, Plus, ScanBarcode } from 'lucide-react';
import Link from 'next/link';
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
import { generateId } from '@/lib/utils';
import { useFoodDictionary } from '@/hooks/use-food-dictionary';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import { toast } from '@/lib/toast';
import { BarcodeScanner } from '@/components/BarcodeScanner';

export interface AddFoodFormProps {
    onSuccess?: () => void;
    initialData?: FoodItem;
}

interface ManualFoodFormValues {
    name: string;
    protein?: number;
    fat?: number;
    carbs?: number;
    calories?: number;
    store?: string;
}

interface BarcodeMappedFood {
    name: string;
    protein: number;
    fat: number;
    carbs: number;
    calories: number;
    store?: string;
}


export function AddFoodForm({ onSuccess, initialData }: AddFoodFormProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('manual');
    const {uniqueStores} = useFoodDictionary();
    const [saveToDictionary, setSaveToDictionary] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
    const [barcodeLookupInput, setBarcodeLookupInput] = useState('');
    const [mappedFoodData, setMappedFoodData] = useState<BarcodeMappedFood | null>(null);

    const { eatDate, setEatDate, eatTime, setEatTime, getSelectedTimestamp } = useEatDateTime();


    // Form for manual entry
    const { register, handleSubmit, reset } = useForm<ManualFoodFormValues>({
        defaultValues: initialData ? {
            name: initialData.name,
            protein: initialData.protein,
            fat: initialData.fat,
            carbs: initialData.carbs,
            calories: initialData.calories,
            store: initialData.store,
        } : undefined
    });

    const fetchBarcodeMapping = async (code: string): Promise<BarcodeMappedFood | null> => {
        const response = await fetch(`/api/barcode?code=${code}`);

        if (response.ok) {
            const data: BarcodeMappedFood = await response.json();
            setMappedFoodData(data);
            reset({
                name: data.name,
                protein: data.protein,
                fat: data.fat,
                carbs: data.carbs,
                calories: data.calories,
                store: data.store,
            });
            return data;
        }

        if (response.status === 404) {
            setMappedFoodData(null);
            reset({
                name: '',
                protein: undefined,
                fat: undefined,
                carbs: undefined,
                calories: undefined,
                store: '',
            });
            return null;
        }

        const errorBody = await response.json();
        throw new Error(errorBody.error || '商品情報の取得に失敗しました');
    };

    const onSubmitManual = async (data: ManualFoodFormValues) => {
        // Basic validation / conversion
        const item: FoodItem = {
            id: generateId(),
            name: data.name,
            protein: Number(data.protein ?? 0),
            fat: Number(data.fat ?? 0),
            carbs: Number(data.carbs ?? 0),
            calories: Number(data.calories ?? 0),
            store: data.store || undefined,
            timestamp: getSelectedTimestamp(),
        };

        addFoodItem(item);
        if (saveToDictionary) {
            addFoodToDictionary(item);
            toast.success('食品リストにも保存しました');
        }
        toast.success(item.name + 'を追加しました');

        // KVSにバーコードデータを保存する
        if (scannedBarcode) {
            try {
                const kvsFoodData = {
                    name: item.name,
                    protein: item.protein,
                    fat: item.fat,
                    carbs: item.carbs,
                    calories: item.calories,
                    store: item.store,
                };
                await fetch('/api/barcode', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ barcode: scannedBarcode, foodData: kvsFoodData }),
                });
                toast.success('バーコード情報も保存しました');
            } catch (error) {
                console.error('Failed to save barcode data to KVS:', error);
                toast.error('バーコード情報の保存に失敗しました');
            } finally {
                setScannedBarcode(null); // KVS保存後、scannedBarcodeをクリア
                setMappedFoodData(null);
                setBarcodeLookupInput('');
            }
        }


        reset();
        setSaveToDictionary(false);
        if (onSuccess) {
            onSuccess();
        } else {
            router.push('/');
        }
    };

        const handleScanSuccess = async (code: string) => {
            setShowScanner(false);
            setScannedBarcode(code); // バーコードを保存
            const loadingToast = toast.loading('商品情報を取得中...');
    
            try {
                const data = await fetchBarcodeMapping(code);
                toast.dismiss(loadingToast);
                setActiveTab('manual');

                if (data) {
                    toast.success(`「${data.name}」が見つかりました (${code})`);
                } else {
                    toast.dismiss(loadingToast);
                    toast.info('バーコードが見つかりませんでした。手動で入力してください。');
                }
            } catch (error) {
                toast.dismiss(loadingToast);
                toast.error(error instanceof Error ? error.message : 'エラーが発生しました');
                console.error(error);
            }
        };

        const handleLookupBarcode = async () => {
            const code = barcodeLookupInput.trim();

            if (!code) {
                toast.info('確認したいバーコードを入力してください');
                return;
            }

            const loadingToast = toast.loading('バーコードのマッピングを確認中...');
            setScannedBarcode(code);

            try {
                const data = await fetchBarcodeMapping(code);
                toast.dismiss(loadingToast);
                setActiveTab('manual');

                if (data) {
                    toast.success(`「${data.name}」のマッピングを表示しています`);
                } else {
                    toast.info('このバーコードは未登録です。手動入力で登録できます。');
                }
            } catch (error) {
                toast.dismiss(loadingToast);
                toast.error(error instanceof Error ? error.message : 'エラーが発生しました');
                console.error(error);
            }
        };
    
    
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
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="manual">手動</TabsTrigger>
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
                                        {scannedBarcode && (
                                            <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                                                <span>バーコード: {scannedBarcode}</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 px-2"
                                                    onClick={() => {
                                                        setScannedBarcode(null);
                                                        setMappedFoodData(null);
                                                    }}
                                                >
                                                    クリア
                                                </Button>
                                            </div>
                                        )}
                                        <div className="space-y-2 rounded-md border border-dashed p-3">
                                            <Label htmlFor="barcodeLookup">バーコードのマッピング確認</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="barcodeLookup"
                                                    value={barcodeLookupInput}
                                                    onChange={(event) => setBarcodeLookupInput(event.target.value)}
                                                    placeholder="例: 4900000000000"
                                                />
                                                <Button type="button" variant="secondary" onClick={handleLookupBarcode}>
                                                    確認
                                                </Button>
                                            </div>
                                            <Button type="button" variant="link" className="h-auto w-fit px-0 text-xs" asChild>
                                                <Link href="/barcode-mappings">マッピング一覧ページを見る</Link>
                                            </Button>
                                            {scannedBarcode && (
                                                <div className="rounded-md bg-muted p-3 text-sm">
                                                    <p className="font-medium">現在のバーコード: {scannedBarcode}</p>
                                                    {mappedFoodData ? (
                                                        <ul className="mt-2 space-y-1 text-muted-foreground">
                                                            <li>食品名: {mappedFoodData.name}</li>
                                                            <li>P/F/C: {mappedFoodData.protein} / {mappedFoodData.fat} / {mappedFoodData.carbs} g</li>
                                                            <li>カロリー: {mappedFoodData.calories} kcal</li>
                                                            <li>店名: {mappedFoodData.store || '未設定'}</li>
                                                        </ul>
                                                    ) : (
                                                        <p className="mt-2 text-muted-foreground">このバーコードに対応するマッピングは未登録です。</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
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
                                                    step="0.01"
                                                    {...register('protein', { valueAsNumber: true })}
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>脂質 (g)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    {...register('fat', { valueAsNumber: true })}
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>炭水化物 (g)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    {...register('carbs', { valueAsNumber: true })}
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>カロリー</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    {...register('calories', { valueAsNumber: true })}
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
