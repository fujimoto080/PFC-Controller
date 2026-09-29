'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2Icon, X } from 'lucide-react';
import { AiReadingLog } from '@/components/input/AiReadingLog';
import { ImageFileInput } from '@/components/input/ImageFileInput';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { MAX_READING_IMAGES } from '@/lib/barcode';

interface NutritionPhotoButtonProps {
  /** 溜めた写真（同じ商品を別の面から撮ったもの）をまとめて渡す。 */
  onRead: (files: File[]) => void;
  disabled: boolean;
  /** 写真を読み取り中か。 */
  reading: boolean;
}

/**
 * 栄養成分表示や料理を撮影する（または保存済みの画像を選ぶ）ボタン。
 * 成分表示と商品名が別の面にある場合のため、写真を複数枚溜めてからまとめて読み取らせる。
 * 直近の読み取り結果も確認できる。
 */
export function NutritionPhotoButton({
  onRead,
  disabled,
  reading,
}: NutritionPhotoButtonProps) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files],
  );
  useEffect(
    () => () => {
      previews.forEach((src) => {
        URL.revokeObjectURL(src);
      });
    },
    [previews],
  );
  const full = files.length >= MAX_READING_IMAGES;
  const add = (added: File[]) => {
    setFiles((current) => [...current, ...added].slice(0, MAX_READING_IMAGES));
  };
  const read = () => {
    onRead(files);
    setFiles([]);
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => cameraRef.current?.click()}
          disabled={disabled || full}
        >
          <Camera /> 成分表示・商品名・料理を撮影
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => pickerRef.current?.click()}
          disabled={disabled || full}
          aria-label="保存済みの画像を追加"
        >
          <ImagePlus /> 画像
        </Button>
      </div>
      {files.length > 0 && (
        <div className="space-y-2">
          <ul className="flex gap-2">
            {previews.map((src, index) => (
              <li key={src} className="relative">
                {/* oxlint-disable-next-line nextjs/no-img-element -- 端末内の写真のプレビューで最適化は不要 */}
                <img
                  src={src}
                  alt={`撮影した写真 ${index + 1}`}
                  className="bg-muted size-16 rounded object-cover"
                />
                <IconButton
                  type="button"
                  className="bg-background absolute -top-2 -right-2 size-6 rounded-full border"
                  aria-label={`写真 ${index + 1} を外す`}
                  onClick={() => {
                    setFiles((current) =>
                      current.filter((_, i) => i !== index),
                    );
                  }}
                >
                  <X />
                </IconButton>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            className="w-full"
            onClick={read}
            disabled={disabled}
          >
            {reading ? (
              <>
                <Loader2Icon className="animate-spin" /> 写真から読み取り中...
              </>
            ) : (
              `${files.length}枚の写真から自動入力`
            )}
          </Button>
        </div>
      )}
      {files.length === 0 && reading && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2Icon className="size-4 animate-spin" /> 写真から読み取り中...
        </p>
      )}
      <ImageFileInput ref={cameraRef} capture onSelect={add} />
      <ImageFileInput ref={pickerRef} multiple onSelect={add} />
      <AiReadingLog />
    </>
  );
}
