'use client';

import { Trash2 } from 'lucide-react';
import { FoodForm } from '@/components/input/FoodForm';
import { RecordDrawer } from '@/components/record/RecordDrawer';
import { Button } from '@/components/ui/button';
import { deleteLogItem } from '@/lib/client/actions';
import { toast } from '@/lib/toast';
import type { FoodItem } from '@/lib/types';

interface EditLogItemDrawerProps {
  item: FoodItem | null;
  onClose: () => void;
}

export function EditLogItemDrawer({ item, onClose }: EditLogItemDrawerProps) {
  const handleDelete = async () => {
    if (!item || !confirm('この記録を削除しますか？')) return;
    if (await deleteLogItem(item.id)) {
      toast.success('削除しました');
      onClose();
    }
  };
  return (
    <RecordDrawer open={item !== null} onClose={onClose} title="記録を編集">
      {item && (
        <FoodForm
          key={item.id}
          initial={item}
          logId={item.id}
          initialTimestamp={item.timestamp}
          defaultSaveFood={false}
          onDone={onClose}
          onCancel={onClose}
        />
      )}
      <Button
        type="button"
        variant="destructive"
        className="mt-4 w-full"
        onClick={() => {
          void handleDelete();
        }}
      >
        <Trash2 /> この記録を削除
      </Button>
    </RecordDrawer>
  );
}
