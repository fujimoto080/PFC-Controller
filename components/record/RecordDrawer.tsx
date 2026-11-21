'use client';

import type { ReactNode, Ref } from 'react';
import { ChevronLeft, X } from 'lucide-react';
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
  scrollRef?: Ref<HTMLDivElement>;
}

/** 記録用のボトムシート。中身はスクロールできる。 */
export function RecordDrawer({
  open,
  onClose,
  onClosed,
  title,
  onBack,
  children,
  scrollRef,
}: RecordDrawerProps) {
  return (
    <Drawer
      open={open}
      dismissible={false}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      onAnimationEnd={(isOpen) => {
        if (!isOpen) onClosed?.();
      }}
    >
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:h-[100dvh] data-[vaul-drawer-direction=bottom]:max-h-[100dvh] data-[vaul-drawer-direction=bottom]:rounded-none">
        <DrawerHeader className="relative shrink-0 border-b">
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
          <IconButton
            className="absolute top-2 right-2"
            onClick={onClose}
            aria-label="閉じる"
          >
            <X />
          </IconButton>
        </DrawerHeader>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8">{children}</div>
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
