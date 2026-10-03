'use client';

import { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Plus, Sparkles } from 'lucide-react';
import { ImageFileInput } from '@/components/input/ImageFileInput';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAiNutrition } from '@/hooks/use-ai-nutrition';
import { MAX_READING_IMAGES } from '@/lib/barcode';
import type { FoodTemplate } from '@/lib/food-form';

/** 食べた物を文章で書くか画像を送るだけで AI が栄養値を推定する入力欄。推定結果は onEstimated に渡す。手入力の追加ボタンも並べ、操作すると入力欄が広がる。 */
export function QuickAiInput({
  onEstimated,
  onAdd,
}: {
  onEstimated: (food: FoodTemplate, photos?: string[]) => void;
  onAdd: () => void;
}) {
  const ai = useAiNutrition(onEstimated);
  const busy = ai.pending !== null;
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(false);
  // 文字が残っている間は、フォーカスが外れても広げたままにする
  const expanded = focused || ai.text !== '';

  return (
    <form
      className="flex items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void ai.estimate().then((ok) => {
          if (ok) ai.setText('');
        });
      }}
    >
      <div className="relative flex-1">
        <Sparkles className="text-primary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Textarea
          value={ai.text}
          onChange={(event) => {
            ai.setText(event.target.value);
          }}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          placeholder="食べた物を書いてAIで記録"
          aria-label="食べた物を書いてAIで記録"
          rows={1}
          className={`resize-none pl-9 transition-[height] ${expanded ? 'h-28' : 'h-9 py-1.5'}`}
          disabled={busy}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => cameraRef.current?.click()}
        disabled={busy}
        aria-label="撮影してAIで記録"
      >
        <Camera />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => pickerRef.current?.click()}
        disabled={busy}
        aria-label="画像を送ってAIで記録"
      >
        {ai.pending === 'image' ? (
          <Loader2 className="animate-spin" />
        ) : (
          <ImagePlus />
        )}
      </Button>
      <Button type="submit" disabled={busy} aria-label="AI で推定">
        {ai.pending === 'text' ? <Loader2 className="animate-spin" /> : '推定'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onAdd}
        aria-label="手入力で追加"
      >
        <Plus />
      </Button>
      <ImageFileInput
        ref={cameraRef}
        capture
        onSelect={(files) => {
          void ai.estimateFromImages(files);
        }}
      />
      <ImageFileInput
        ref={pickerRef}
        multiple
        onSelect={(files) => {
          void ai.estimateFromImages(files.slice(0, MAX_READING_IMAGES));
        }}
      />
    </form>
  );
}
