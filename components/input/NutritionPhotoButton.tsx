'use client';

import { useRef } from 'react';
import { Camera, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NutritionPhotoButtonProps {
  onCapture: (file: File) => void;
  disabled: boolean;
  /** 撮影した写真を読み取り中か。 */
  reading: boolean;
}

/** 栄養成分表示や料理を撮影し、その写真を渡すボタン。 */
export function NutritionPhotoButton({
  onCapture,
  disabled,
  reading,
}: NutritionPhotoButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        {reading ? (
          <>
            <Loader2Icon className="animate-spin" /> 写真から読み取り中...
          </>
        ) : (
          <>
            <Camera /> 成分表示・料理を撮影して自動入力
          </>
        )}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onClick={(event) => {
          event.currentTarget.value = '';
        }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onCapture(file);
        }}
      />
    </>
  );
}
