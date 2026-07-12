'use client';

import { useEffect } from 'react';
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
import { safePfcNumber } from '@/lib/pfc';
import { PfcMacroInputs } from '@/components/input/PfcFieldsGroup';
import { EatDateTimeFields } from '@/components/input/EatDateTimeFields';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import { updateLogItem, deleteLogItem } from '@/lib/storage/logs';

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
    const { eatDate, setEatDate, eatTime, setEatTime, getSelectedTimestamp } =
        useEatDateTime(item?.timestamp);

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
        }
    }, [item, reset]);

    const onSubmit = async (data: FoodItem) => {
        if (!item) return;

        const updatedItem: FoodItem = {
            ...item,
            name: data.name,
            protein: safePfcNumber(data.protein),
            fat: safePfcNumber(data.fat),
            carbs: safePfcNumber(data.carbs),
            calories: safePfcNumber(data.calories),
            store: data.store || undefined,
            timestamp: getSelectedTimestamp(),
        };

        try {
            await updateLogItem(item.timestamp, updatedItem);
            toast.success('更新しました');
            onSuccess();
            onOpenChange(false);
        } catch {
            // updateLogItem 側でエラートーストを表示済み
        }
    };

    const handleDelete = async () => {
        if (!item) return;
        if (confirm('この記録を削除しますか？')) {
            try {
                await deleteLogItem(item.id, item.timestamp);
                toast.success('削除しました');
                onOpenChange(false);
            } catch {
                // deleteLogItem 側でエラートーストを表示済み
            }
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

                            <EatDateTimeFields
                                eatDate={eatDate}
                                setEatDate={setEatDate}
                                eatTime={eatTime}
                                setEatTime={setEatTime}
                            />

                            <PfcMacroInputs register={register} step="0.1" withIds />
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
