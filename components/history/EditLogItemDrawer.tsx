'use client';

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
import { toFoodInput, toFormValues, type PfcFormValues } from '@/lib/food-form';
import { PfcMacroInputs } from '@/components/input/PfcFieldsGroup';
import { EatDateTimeFields } from '@/components/input/EatDateTimeFields';
import { useEatDateTime } from '@/hooks/use-eat-datetime';
import { deleteLogItem, updateLogItem } from '@/lib/client/actions';

interface EditLogItemDrawerProps {
  item: FoodItem | null;
  onClose: () => void;
}

const FORM_ID = 'edit-log-item-form';

export function EditLogItemDrawer({ item, onClose }: EditLogItemDrawerProps) {
  return (
    <Drawer
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent>
        {/* 編集対象ごとにフォームを作り直して初期値を反映する */}
        {item && (
          <EditLogItemForm key={item.id} item={item} onClose={onClose} />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function EditLogItemForm({
  item,
  onClose,
}: {
  item: FoodItem;
  onClose: () => void;
}) {
  const eatAt = useEatDateTime(item.timestamp);
  const { register, handleSubmit } = useForm<PfcFormValues>({
    defaultValues: toFormValues(item),
  });

  const onSubmit = async (values: PfcFormValues) => {
    const updated: FoodItem = {
      ...item,
      ...toFoodInput(
        { ...values, storeGroup: item.storeGroup },
        eatAt.timestamp,
      ),
    };
    if (await updateLogItem(updated)) {
      toast.success('更新しました');
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!confirm('この記録を削除しますか？')) return;
    if (await deleteLogItem(item.id)) {
      toast.success('削除しました');
      onClose();
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg">
      <DrawerHeader>
        <DrawerTitle>記録を編集</DrawerTitle>
        <DrawerDescription>
          食品の内容や記録した日時を修正できます。
        </DrawerDescription>
      </DrawerHeader>
      <div className="p-4 pb-0">
        <form
          id={FORM_ID}
          onSubmit={(e) => {
            void handleSubmit(onSubmit)(e);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="edit-log-item-name">食品名</Label>
            <Input
              id="edit-log-item-name"
              {...register('name', { required: true })}
            />
          </div>
          <EatDateTimeFields value={eatAt.value} onChange={eatAt.onChange} />
          <PfcMacroInputs register={register} />
        </form>
      </div>
      <DrawerFooter className="flex-row gap-2">
        <Button
          variant="destructive"
          className="flex-1"
          onClick={() => {
            void handleDelete();
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> 削除
        </Button>
        <Button type="submit" form={FORM_ID} className="flex-1">
          <Save className="mr-2 h-4 w-4" /> 保存
        </Button>
        <DrawerClose asChild>
          <IconButton>
            <X className="h-4 w-4" />
          </IconButton>
        </DrawerClose>
      </DrawerFooter>
    </div>
  );
}
