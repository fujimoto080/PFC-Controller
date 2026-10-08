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
import { type FoodTemplate } from '@/lib/food-form';
import { FoodForm } from '@/components/input/FoodForm';

/** 検索や AI からフォームへ渡す初期値。 */
export interface RecordStep {
  food?: FoodTemplate;
  photos?: string[];
}

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
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[92dvh]">
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
  onDone: () => void;
}

export function RecordStepView({
  step,
  timestamp,
  onDone,
}: RecordStepViewProps) {
  return (
    <FoodForm
      initial={step.food}
      photos={step.photos}
      initialTimestamp={timestamp}
      onDone={onDone}
      onCancel={onDone}
    />
  );
}
