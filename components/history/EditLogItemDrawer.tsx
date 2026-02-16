'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Trash2, Save, X } from 'lucide-react';
import { toast } from '@/lib/toast';

import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FoodItem } from '@/lib/types';
import { updateLogItem, deleteLogItem } from '@/lib/storage';

interface EditLogItemDrawerProps {
    item: FoodItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function EditLogItemDrawer({
    item,
    open,
    onOpenChange,
    onSuccess,
}: EditLogItemDrawerProps) {
    const [eatDate, setEatDate] = useState('');
    const [eatTime, setEatTime] = useState('');

    const { register, handleSubmit, reset } = useForm<FoodItem>();

    useEffect(() => {
        if (item) {
            reset({
                name: item.name,
                protein: item.protein,
                fat: item.fat,
                carbs: item.carbs,
                calories: item.calories,
                store: item.store,
            });
            const date = new Date(item.timestamp);
            queueMicrotask(() => {
                setEatDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
                setEatTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
            });
        }
    }, [item, reset]);

    const getSelectedTimestamp = () => {
        const [year, month, day] = eatDate.split('-').map(Number);
        const [hour, minute] = eatTime.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute).getTime();
    };

    const onSubmit = (data: FoodItem) => {
        if (!item) return;

        const updatedItem: FoodItem = {
            ...item,
            name: data.name,
            protein: Number(data.protein),
            fat: Number(data.fat),
            carbs: Number(data.carbs),
            calories: Number(data.calories),
            store: data.store || undefined,
            timestamp: getSelectedTimestamp(),
        };

        updateLogItem(item.timestamp, updatedItem);
        toast.success('更新しました');
        onSuccess();
        onOpenChange(false);
    };

    const handleDelete = () => {
        if (!item) return;
        if (confirm('この記録を削除しますか？')) {
            deleteLogItem(item.id, item.timestamp);
            toast.success('削除しました');
            onOpenChange(false);
        }
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-lg">
                    <DrawerHeader>
                        <DrawerTitle>記録を編集</DrawerTitle>
                        <DrawerDescription>
                            食品の内容や記録した日時を修正できます。
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4 pb-0">
                        <form id="edit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">食品名</Label>
                                <Input id="name" {...register('name', { required: true })} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="date">日付</Label>
                                    <Input
                                        id="date"
                                        type="date"
                                        value={eatDate}
                                        onChange={(e) => setEatDate(e.target.value)}
                                        onClick={(e) => e.currentTarget.showPicker?.()}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="time">時刻</Label>
                                    <Input
                                        id="time"
                                        type="time"
                                        value={eatTime}
                                        onChange={(e) => setEatTime(e.target.value)}
                                        onClick={(e) => e.currentTarget.showPicker?.()}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="protein">タンパク質 (g)</Label>
                                    <Input
                                        id="protein"
                                        type="number"
                                        step="0.1"
                                        {...register('protein')}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fat">脂質 (g)</Label>
                                    <Input
                                        id="fat"
                                        type="number"
                                        step="0.1"
                                        {...register('fat')}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="carbs">炭水化物 (g)</Label>
                                    <Input
                                        id="carbs"
                                        type="number"
                                        step="0.1"
                                        {...register('carbs')}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="calories">カロリー</Label>
                                    <Input
                                        id="calories"
                                        type="number"
                                        {...register('calories')}
                                    />
                                </div>
                            </div>
                        </form>
                    </div>
                    <DrawerFooter className="flex-row gap-2">
                        <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={handleDelete}
                        >
                            <Trash2 className="mr-2 h-4 w-4" /> 削除
                        </Button>
                        <Button type="submit" form="edit-form" className="flex-1">
                            <Save className="mr-2 h-4 w-4" /> 保存
                        </Button>
                        <DrawerClose asChild>
                            <IconButton>
                                <X className="h-4 w-4" />
                            </IconButton>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
