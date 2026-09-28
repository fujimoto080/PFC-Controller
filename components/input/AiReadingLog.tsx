'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReadingConfidence } from '@/lib/barcode';
import { useAiReadings, type AiReading } from '@/lib/client/ai-readings';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

/** 直近の写真の AI 読み取りについて、送った画像と AI の応答をそのまま見せる。読み取りが無ければ何も出さない。 */
export function AiReadingLog({ className }: { className?: string }) {
  const readings = useAiReadings();
  if (readings.length === 0) return null;
  return (
    <details className={cn('rounded-lg border', className)}>
      <summary className="text-muted-foreground cursor-pointer px-3 py-2 text-xs">
        写真の読み取り結果を確認（直近{readings.length}件）
      </summary>
      <ul className="divide-y border-t">
        {readings.map((reading) => (
          <ReadingEntry key={reading.id} reading={reading} />
        ))}
      </ul>
    </details>
  );
}

const CONFIDENCE_LABELS: Record<ReadingConfidence, string> = {
  high: '確か',
  medium: 'やや不確か',
  low: '不確か',
};

function ReadingEntry({ reading }: { reading: AiReading }) {
  const [size, setSize] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { response } = reading;
  // base64 の 4 文字が 3 バイトにあたる
  const kilobytes = Math.round(
    ((reading.image.length - reading.image.indexOf(',') - 1) * 3) / 4 / 1024,
  );

  return (
    <li className="space-y-2 p-3">
      <p className="text-muted-foreground flex justify-between text-xs tabular-nums">
        <span>{format(reading.at, 'HH:mm:ss')}</span>
        <span>
          {size && `${size} · `}
          {kilobytes}KB
        </span>
      </p>
      <button
        type="button"
        className="block w-full"
        aria-label={expanded ? '画像を縮める' : '画像を拡大する'}
        onClick={() => {
          setExpanded((value) => !value);
        }}
      >
        {/* oxlint-disable-next-line nextjs/no-img-element -- dataURL の画像は next/image で最適化できない */}
        <img
          src={reading.image}
          alt="送った画像"
          className={cn(
            'bg-muted w-full rounded object-contain',
            !expanded && 'max-h-40',
          )}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            setSize(`${naturalWidth}×${naturalHeight}`);
          }}
        />
      </button>
      {reading.error ? (
        <p className="text-destructive text-xs">{reading.error}</p>
      ) : (
        <p className="text-xs">
          読み取れた食品: {reading.foods.length}件
          {reading.foods.length > 0 &&
            `（${reading.foods
              .map(
                ({ food, confidence }) =>
                  `${food.name}: ${CONFIDENCE_LABELS[confidence]}`,
              )
              .join('、')}）`}
        </p>
      )}
      {response !== undefined && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">AI の応答</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                navigator.clipboard.writeText(response).then(
                  () => toast.success('応答をコピーしました'),
                  (error: unknown) =>
                    toast.fromError('コピーに失敗しました', error),
                );
              }}
            >
              <Copy /> コピー
            </Button>
          </div>
          <pre className="bg-muted max-h-60 overflow-auto rounded p-2 text-[11px] break-all whitespace-pre-wrap">
            {response}
          </pre>
        </div>
      )}
    </li>
  );
}
