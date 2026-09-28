'use client';

import { useRef } from 'react';
import { ImagePlus, Loader2, Sparkles } from 'lucide-react';
import { ImageFileInput } from '@/components/input/ImageFileInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAiNutrition } from '@/hooks/use-ai-nutrition';
import type { FoodTemplate } from '@/lib/food-form';

/** 食べた物を文章で書くか画像を送るだけで AI が栄養値を推定する入力欄。推定結果は onEstimated に渡す。 */
export function QuickAiInput({
  onEstimated,
}: {
  onEstimated: (food: FoodTemplate) => void;
}) {
  const ai = useAiNutrition(onEstimated);
  const busy = ai.pending !== null;
  const pickerRef = useRef<HTMLInputElement | null>(null);

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void ai.estimate().then((ok) => {
          if (ok) ai.setText('');
        });
      }}
    >
      <div className="relative flex-1">
        <Sparkles className="text-primary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={ai.text}
          onChange={(event) => {
            ai.setText(event.target.value);
          }}
          placeholder="食べた物を書いてAIで記録"
          aria-label="食べた物を書いてAIで記録"
          enterKeyHint="send"
          className="pl-9"
          disabled={busy}
        />
      </div>
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
      <ImageFileInput
        ref={pickerRef}
        onSelect={([file]) => {
          if (file) void ai.estimateFromImage(file);
        }}
      />
    </form>
  );
}
