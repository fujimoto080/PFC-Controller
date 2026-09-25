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
import type { FoodItem } from '@/lib/types';
import { toFoodInput, type PfcFormValues } from '@/lib/food-form';
import { PfcMacroInputs } from '@/components/input/PfcFieldsGroup';
import { EatDateTimeFields } from '@/components/input/EatDateTimeFields';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import { deleteLogItem, updateLogItem } from '@/lib/client/actions';

interface EditLogItemDrawerProps {
    item: FoodItem | null;
    onClose: () => void;
}

export function EditLogItemDrawer({ item, onClose }: EditLogItemDrawerProps) {
    const { eatDate, setEatDate, eatTime, setEatTime, getSelectedTimestamp } =
        useEatDateTime(item?.timestamp);

    const { register, handleSubmit, reset } = useForm<PfcFormValues>();

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

    const onSubmit = async (data: PfcFormValues) => {
        if (!item) return;
        const updated: FoodItem = {
            ...item,
            ...toFoodInput({ ...data, storeGroup: item.storeGroup }, getSelectedTimestamp()),
        };
        if (await updateLogItem(updated)) {
            toast.success('更新しました');
            onClose();
        }
    };

    const handleDelete = async () => {
        if (!item || !confirm('この記録を削除しますか？')) return;
        if (await deleteLogItem(item.id)) {
            toast.success('削除しました');
            onClose();
        }
    };

    return (
        <Drawer open={item !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-lg">
                    <DrawerHeader>
                        <DrawerTitle>記録を編集</DrawerTitle>
                        <DrawerDescription>
                            食品の内容や記録した日時を修正できます。
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4 pb-0">
                        <form id="edit-form" onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="space-y-4">
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
                            onClick={() => { void handleDelete(); }}
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
