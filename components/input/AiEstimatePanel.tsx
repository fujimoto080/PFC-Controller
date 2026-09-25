'use client';

import { useRef } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { useAiNutrition } from '@/hooks/use-ai-nutrition';

/** 写真の OCR とテキストからの AI 栄養推定。結果は手動入力フォームに反映される。 */
export function AiEstimatePanel({
  ai,
}: {
  ai: ReturnType<typeof useAiNutrition>;
}) {
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-4 text-center">
      <div className="text-muted-foreground flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6">
        <Camera className="mb-2 h-10 w-10" />
        <p className="mb-3">写真を撮る / 選ぶ</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => photoInputRef.current?.click()}
          disabled={ai.isExtracting}
        >
          画像を選択する
        </Button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onClick={(event) => {
            event.currentTarget.value = '';
          }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void ai.extractFromImage(file);
          }}
        />
      </div>
      <div className="space-y-2 text-left">
        <Label htmlFor="aiInputText">食べた内容をテキストで入力</Label>
        <Input
          id="aiInputText"
          value={ai.text}
          onChange={(event) => {
            ai.setText(event.target.value);
          }}
          placeholder="例: コンビニのおにぎり2個とサラダチキン"
        />
        <Button
          type="button"
          className="w-full"
          onClick={() => {
            void ai.estimate();
          }}
          disabled={ai.isEstimating || ai.isExtracting}
        >
          {ai.isEstimating ? 'AIで推定中...' : 'AIでPFCを入力する'}
        </Button>
        {ai.isExtracting && (
          <p className="text-muted-foreground text-xs">
            OCR処理中です。完了までしばらくお待ちください。
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          推定結果は手動入力フォームに反映されます。必要に応じて調整してください。
        </p>
      </div>
    </div>
  );
}
