'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Flashlight, FlashlightOff } from 'lucide-react';
import {
  applyCameraSettings,
  setContinuousFocus,
  supportsFocusMode,
  toVideoPoint,
} from '@/lib/client/camera';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

// タップでピントを合わせたあと、連続オートフォーカスに戻すまでの時間
const TAP_FOCUS_HOLD_MS = 3000;
const FOCUS_RING_MS = 800;

interface FocusRing {
  left: number;
  top: number;
  key: number;
}

/**
 * カメラ映像に重ねる操作。タップした位置へのピント合わせ・ズーム・ライトを、端末が対応しているものだけ出す。
 * 映像の親要素（relative）の中に置く。
 */
export function CameraControls({
  track,
  videoRef,
}: {
  track: MediaStreamTrack | null;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  if (!track) return null;
  // track が変わったら操作の状態を作り直す
  return <TrackControls key={track.id} track={track} videoRef={videoRef} />;
}

function TrackControls({
  track,
  videoRef,
}: {
  track: MediaStreamTrack;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const [capabilities] = useState(() => track.getCapabilities());
  const [zoom, setZoom] = useState(() => track.getSettings().zoom);
  const [torch, setTorch] = useState(false);
  const [focusRing, setFocusRing] = useState<FocusRing | null>(null);
  const focusTimer = useRef<number | undefined>(undefined);
  const ringTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(focusTimer.current);
      window.clearTimeout(ringTimer.current);
    },
    [],
  );

  const canTapFocus = supportsFocusMode(track, 'single-shot');
  // ズームできる範囲。端末が対応していなければ null
  const { min, max, step } = capabilities.zoom ?? {};
  const zoomRange =
    min !== undefined && max !== undefined && max > min
      ? { min, max, step: step ?? 0.1 }
      : null;
  const zoomValue = zoom ?? min ?? 1;

  /** 設定を反映する。失敗したらトーストを出して false を返す */
  const apply = (settings: MediaTrackConstraintSet, failure: string) =>
    applyCameraSettings(track, settings).then(
      () => true,
      (error: unknown) => {
        toast.fromError(failure, error);
        return false;
      },
    );

  const focusAt = (clientX: number, clientY: number, target: HTMLElement) => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const rect = target.getBoundingClientRect();
    setFocusRing({
      left: clientX - rect.left,
      top: clientY - rect.top,
      key: Date.now(),
    });
    window.clearTimeout(ringTimer.current);
    ringTimer.current = window.setTimeout(() => {
      setFocusRing(null);
    }, FOCUS_RING_MS);

    void apply(
      {
        focusMode: 'single-shot',
        pointsOfInterest: [toVideoPoint(video, clientX, clientY)],
      },
      'ピントを合わせられませんでした',
    );
    // 商品を次々かざすため、しばらくしたら被写体に合わせ続けるモードに戻す
    window.clearTimeout(focusTimer.current);
    focusTimer.current = window.setTimeout(() => {
      void setContinuousFocus(track);
    }, TAP_FOCUS_HOLD_MS);
  };

  return (
    <>
      {canTapFocus && (
        <button
          type="button"
          className="absolute inset-0 cursor-crosshair"
          aria-label="タップした位置にピントを合わせる"
          onClick={(event) => {
            focusAt(event.clientX, event.clientY, event.currentTarget);
          }}
        />
      )}
      {focusRing && (
        <div
          key={focusRing.key}
          className="animate-in zoom-in-150 fade-in pointer-events-none absolute size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yellow-300 duration-200"
          style={{ left: focusRing.left, top: focusRing.top }}
        />
      )}
      {(zoomRange !== null || capabilities.torch === true) && (
        <div className="absolute inset-x-3 top-3 flex items-center gap-2">
          {zoomRange && (
            <>
              <input
                type="range"
                min={zoomRange.min}
                max={zoomRange.max}
                step={zoomRange.step}
                value={zoomValue}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setZoom(value);
                  void apply({ zoom: value }, 'ズームできませんでした');
                }}
                className="min-w-0 flex-1 accent-white"
                aria-label="ズーム"
              />
              <span className="w-10 shrink-0 rounded-full bg-black/50 py-0.5 text-center text-[11px] text-white tabular-nums">
                {zoomValue.toFixed(1)}x
              </span>
            </>
          )}
          {capabilities.torch && (
            <button
              type="button"
              className={cn(
                'ml-auto flex size-9 shrink-0 items-center justify-center rounded-full',
                torch ? 'bg-yellow-300 text-black' : 'bg-black/50 text-white',
              )}
              aria-label={torch ? 'ライトを消す' : 'ライトをつける'}
              aria-pressed={torch}
              onClick={() => {
                const next = !torch;
                setTorch(next);
                void apply(
                  { torch: next },
                  'ライトを切り替えられませんでした',
                ).then((ok) => {
                  if (!ok) setTorch(!next);
                });
              }}
            >
              {torch ? (
                <FlashlightOff className="size-4" />
              ) : (
                <Flashlight className="size-4" />
              )}
            </button>
          )}
        </div>
      )}
    </>
  );
}
