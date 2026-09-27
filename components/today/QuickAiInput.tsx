'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAiNutrition } from '@/hooks/use-ai-nutrition';
import type { FoodTemplate } from '@/lib/food-form';

/** 食べた物を文章で書くだけで AI が栄養値を推定する入力欄。推定結果は onEstimated に渡す。 */
export function QuickAiInput({
  onEstimated,
}: {
  onEstimated: (food: FoodTemplate) => void;
}) {
  const ai = useAiNutrition(onEstimated);
  const busy = ai.pending !== null;

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
      <Button type="submit" disabled={busy} aria-label="AI で推定">
        {busy ? <Loader2 className="animate-spin" /> : '推定'}
      </Button>
    </form>
  );
}
