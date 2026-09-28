'use client';

import type { Ref } from 'react';

/**
 * 画像ファイルを選ぶ非表示の input。ref の click() で開く。
 * capture ならカメラを直接起動し、無ければ保存済みの画像から選ばせる。同じ画像を続けて選べるよう開くたびに選択を空にする。
 */
export function ImageFileInput({
  ref,
  capture = false,
  multiple = false,
  onSelect,
}: {
  ref: Ref<HTMLInputElement>;
  capture?: boolean;
  multiple?: boolean;
  onSelect: (files: File[]) => void;
}) {
  return (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      capture={capture ? 'environment' : undefined}
      multiple={multiple}
      className="hidden"
      onClick={(event) => {
        event.currentTarget.value = '';
      }}
      onChange={(event) => {
        const files = [...(event.target.files ?? [])];
        if (files.length > 0) onSelect(files);
      }}
    />
  );
}
