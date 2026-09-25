'use client';

import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { IconButton } from '@/components/ui/icon-button';
import { addFoodItem } from '@/lib/client/actions';
import { toLogInput, type FoodTemplate } from '@/lib/food-form';
import { toast } from '@/lib/toast';
import { ConfirmFood } from './ConfirmFood';
import { FoodLogForm } from './FoodLogForm';

/** 記録シート内の画面。確認して 1 タップで記録するか、フォームで入力して記録する。 */
export type RecordStep =
  | { kind: 'confirm'; food: FoodTemplate }
  | { kind: 'form'; food?: FoodTemplate };

interface RecordDrawerProps {
  open: boolean;
  onClose: () => void;
  /** 閉じるアニメーションが終わったとき。中身の状態リセットに使う。 */
  onClosed?: () => void;
  title: string;
  /** 指定するとヘッダーに戻るボタンを出す。 */
  onBack?: () => void;
  children: ReactNode;
}

/** 記録用のボトムシート。中身はスクロールできる。 */
export function RecordDrawer({
  open,
  onClose,
  onClosed,
  title,
  onBack,
  children,
}: RecordDrawerProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      onAnimationEnd={(isOpen) => {
        if (!isOpen) onClosed?.();
      }}
    >
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[92vh]">
        <DrawerHeader className="relative">
          {onBack && (
            <IconButton
              className="absolute top-2 left-2"
              onClick={onBack}
              aria-label="戻る"
            >
              <ChevronLeft />
            </IconButton>
          )}
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-8">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}

interface RecordStepViewProps {
  step: RecordStep;
  timestamp: number;
  barcode?: string;
  onStepChange: (step: RecordStep) => void;
  onDone: () => void;
}

export function RecordStepView({
  step,
  timestamp,
  barcode,
  onStepChange,
  onDone,
}: RecordStepViewProps) {
  if (step.kind === 'form') {
    return (
      <FoodLogForm
        initial={step.food}
        initialTimestamp={timestamp}
        barcode={barcode}
        onDone={onDone}
      />
    );
  }

  return (
    <ConfirmFood
      food={step.food}
      onRecord={(food) => {
        // 楽観的に即時反映されるため応答を待たずに閉じる
        void addFoodItem(toLogInput(food, timestamp));
        toast.success(`${food.name}を記録しました`);
        onDone();
      }}
      onEdit={() => {
        onStepChange({ kind: 'form', food: step.food });
      }}
    />
  );
}
