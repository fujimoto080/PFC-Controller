'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Camera, Search, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { addFoodItem } from '@/lib/storage';
import { FoodItem } from '@/lib/types';
import publicFoods from '@/data/public_foods.json';
import { toast } from 'sonner';

export function AddFoodForm() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('manual');
  const [searchQuery, setSearchQuery] = useState('');

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
      timestamp: Date.now(),
    };

    addFoodItem(item);
    toast.success(item.name + 'を追加しました');
    reset();
    router.push('/');
  };

  const handleAddPublic = (food: any) => {
    const item: FoodItem = {
      ...food,
      id: Date.now().toString(), // unique id for log
      timestamp: Date.now(),
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
      <Tabs defaultValue="manual" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="manual">手動入力</TabsTrigger>
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
                  <div className="max-h-[300px] space-y-2 overflow-y-auto">
                    {filteredFoods.map((food) => (
                      <div
                        key={food.id}
                        className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
                        role="button"
                        onClick={() => handleAddPublic(food)}
                      >
                        <div>
                          <div className="font-medium">{food.name}</div>
                          <div className="text-muted-foreground text-xs">
                            P:{food.protein} F:{food.fat} C:{food.carbs} |{' '}
                            {food.calories}kcal
                          </div>
                        </div>
                        <Button size="icon" variant="ghost">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {filteredFoods.length === 0 && (
                      <div className="text-muted-foreground py-4 text-center text-sm">
                        食品が見つかりません。
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
    </div>
  );
}
