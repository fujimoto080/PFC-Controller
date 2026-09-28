'use client';

import { useRef } from 'react';
import { Camera, ImagePlus, Loader2Icon } from 'lucide-react';
import { AiReadingLog } from '@/components/input/AiReadingLog';
import { ImageFileInput } from '@/components/input/ImageFileInput';
import { Button } from '@/components/ui/button';

interface NutritionPhotoButtonProps {
  onCapture: (file: File) => void;
  disabled: boolean;
  /** 写真を読み取り中か。 */
  reading: boolean;
}

/**
 * 栄養成分表示や料理を撮影する（または保存済みの画像を選ぶ）ボタン。選んだ写真を渡す。
 * 直近の読み取り結果も確認できる。
 */
export function NutritionPhotoButton({
  onCapture,
  disabled,
  reading,
}: NutritionPhotoButtonProps) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const select = ([file]: File[]) => {
    if (file) onCapture(file);
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => cameraRef.current?.click()}
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
        <Button
          type="button"
          variant="outline"
          onClick={() => pickerRef.current?.click()}
          disabled={disabled}
          aria-label="保存済みの画像から自動入力"
        >
          <ImagePlus /> 画像
        </Button>
      </div>
      <ImageFileInput ref={cameraRef} capture onSelect={select} />
      <ImageFileInput ref={pickerRef} onSelect={select} />
      <AiReadingLog />
    </>
  );
}
