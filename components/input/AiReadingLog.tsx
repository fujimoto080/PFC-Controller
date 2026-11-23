'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Copy } from 'lucide-react';
import { PfcMacroLine } from '@/components/pfc/PfcMacroLine';
import { Button } from '@/components/ui/button';
import type { ReadingConfidence } from '@/lib/barcode';
import { useAiReadings, type AiReading } from '@/lib/client/ai-readings';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

/** 最新の読み取り結果を表示し、過去の結果と診断情報は折りたたむ。 */
export function AiReadingLog({ className }: { className?: string }) {
  const [latest, ...previous] = useAiReadings();
  if (!latest) return null;
  return (
    <section
      className={cn('rounded-lg border', className)}
      aria-label="直近の写真読み取り"
    >
      <ul>
        <ReadingEntry key={latest.id} reading={latest} />
      </ul>
      {previous.length > 0 && (
        <details className="border-t">
          <summary className="text-muted-foreground cursor-pointer px-3 py-2 text-xs">
            以前の読み取り（{previous.length}件）
          </summary>
          <ul className="divide-y border-t">
            {previous.map((reading) => (
              <ReadingEntry key={reading.id} reading={reading} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

const CONFIDENCE_LABELS: Record<ReadingConfidence, string> = {
  high: '確か',
  medium: 'やや不確か',
  low: '不確か',
};

/** base64 の dataURL の大きさ（KB）。base64 の 4 文字が 3 バイトにあたる。 */
function dataUrlKilobytes(dataUrl: string): number {
  return Math.round(
    ((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4 / 1024,
  );
}

function SentImage({ image, kilobytes }: { image: string; kilobytes: number }) {
  const [size, setSize] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-right text-xs tabular-nums">
        {size && `${size} · `}
        {kilobytes}KB
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
          src={image}
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
    </div>
  );
}

function ReadingEntry({ reading }: { reading: AiReading }) {
  const { response, drexMs, gpt6Ms, titleProbability, title } = reading;

  return (
    <li className="space-y-2 p-3">
      <p className="text-muted-foreground flex justify-between text-xs tabular-nums">
        <span>写真の読み取り結果</span>
        <time dateTime={new Date(reading.at).toISOString()}>
          {format(reading.at, 'HH:mm:ss')}
        </time>
      </p>
      {title && <p className="text-sm font-medium">{title}</p>}
      {reading.error ? (
        <p className="text-destructive text-xs">{reading.error}</p>
      ) : reading.foods.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          栄養表示を読み取れませんでした
        </p>
      ) : (
        reading.foods.map(({ food, confidence }, index) => (
          <div key={index} className="space-y-0.5">
            <PfcMacroLine food={food} className="tabular-nums" />
            {confidence !== 'high' && (
              <p className="text-muted-foreground text-xs">
                読み取り精度は{CONFIDENCE_LABELS[confidence]}
              </p>
            )}
          </div>
        ))
      )}
      {drexMs !== undefined && (
        <p className="text-muted-foreground text-xs tabular-nums">
          成分表示（Drex）{formatDuration(drexMs)}
          {gpt6Ms !== undefined && ` · 商品名（GPT）${formatDuration(gpt6Ms)}`}
        </p>
      )}
      <details className="border-t pt-2">
        <summary className="text-muted-foreground cursor-pointer text-xs">
          送信した写真とAIの応答
        </summary>
        <div className="mt-2 space-y-2">
          {titleProbability !== undefined && (
            <p className="text-muted-foreground text-xs">
              商品名が写っている確率 {Math.round(titleProbability * 100)}%
            </p>
          )}
          {reading.images.map((image, index) => (
            <SentImage
              key={index}
              image={image}
              kilobytes={dataUrlKilobytes(image)}
            />
          ))}
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
        </div>
      </details>
    </li>
  );
}

function formatDuration(ms: number) {
  return ms < 10 ? `${ms}ミリ秒` : `${(ms / 1000).toFixed(2)}秒`;
}

