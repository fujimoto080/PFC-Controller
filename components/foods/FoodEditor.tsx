'use client';

import { useState } from 'react';
import { FoodForm } from '@/components/input/FoodForm';
import { RecordDrawer } from '@/components/record/RecordDrawer';
import type { BarcodeFood } from '@/lib/barcode';
import type { FoodItem } from '@/lib/types';

interface FoodEditorProps {
  food: FoodItem | null;
  initialBarcodes: string[];
  onBarcodesSaved: (food: BarcodeFood, barcodes: string[]) => void;
  onClose: () => void;
}

export function FoodEditor({
  food,
  initialBarcodes,
  onBarcodesSaved,
  onClose,
}: FoodEditorProps) {
  const [timestamp] = useState(() => Date.now());
  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={food ? '食品を編集' : '食品を登録・記録'}
    >
      <FoodForm
        initial={food ?? undefined}
        foodId={food?.id}
        initialTimestamp={timestamp}
        initialBarcodes={initialBarcodes}
        defaultRecord={false}
        onBarcodesSaved={onBarcodesSaved}
        onDone={onClose}
        onCancel={onClose}
      />
    </RecordDrawer>
  );
}
