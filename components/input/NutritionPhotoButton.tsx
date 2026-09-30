'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2Icon, X } from 'lucide-react';
import { AiReadingLog } from '@/components/input/AiReadingLog';
import { ImageFileInput } from '@/components/input/ImageFileInput';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { MAX_READING_IMAGES } from '@/lib/barcode';

interface NutritionPhotoButtonProps {
  /** 溜めた写真（同じ商品を別の面から撮ったもの）をまとめて渡す。読み取れたら true を返す。 */
  onRead: (files: File[]) => Promise<boolean>;
  disabled: boolean;
  /** 写真を読み取り中か。 */
  reading: boolean;
}

/**
 * 栄養成分表示や料理を撮影する（または保存済みの画像を選ぶ）ボタン。
 * 成分表示と商品名が別の面にある場合のため、写真を複数枚溜めてからまとめて読み取らせる。
 * 読み取った後も写真は残し、写真を足すと前の写真と合わせて読み取り直す（後から撮った面だけで値を上書きしない）。
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
  // 最後に読み取れた写真の組。写真を足す・外すまでは同じ組を読み取り直させない
  const [readFiles, setReadFiles] = useState<File[] | null>(null);
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
  const alreadyRead = readFiles === files;
  const read = async () => {
    if (await onRead(files)) setReadFiles(files);
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
            onClick={() => {
              void read();
            }}
            disabled={disabled || alreadyRead}
          >
            {reading ? (
              <>
                <Loader2Icon className="animate-spin" /> 写真から読み取り中...
              </>
            ) : alreadyRead ? (
              '読み取り済み'
            ) : (
              `${files.length}枚の写真から自動入力`
            )}
          </Button>
          {alreadyRead && !full && (
            <p className="text-muted-foreground text-xs">
              写真を足すと、この写真と合わせて読み取り直します
            </p>
          )}
        </div>
      )}
      <ImageFileInput ref={cameraRef} capture onSelect={add} />
      <ImageFileInput ref={pickerRef} multiple onSelect={add} />
      <AiReadingLog />
    </>
  );
}
