'use client';

import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Camera,
  Check,
  CircleAlert,
  ImagePlus,
  Keyboard,
  Loader2,
  X,
} from 'lucide-react';
import { ManualBarcodeForm } from '@/components/BarcodeScanner';
import { ImageFileInput } from '@/components/input/ImageFileInput';
import { CameraControls } from '@/components/scan/CameraControls';
import { Button } from '@/components/ui/button';
import {
  SCAN_FEEDBACK_CLASS,
  useBarcodeCamera,
} from '@/hooks/use-barcode-camera';
import type { ScanBatch } from '@/hooks/use-scan-batch';
import { vibrate } from '@/lib/client/device';
import {
  captureVideoFrame,
  imageToDataUrl,
  supportsTakePhoto,
  takePhoto,
} from '@/lib/client/image';
import type { BatchItem } from '@/lib/scan-batch';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

interface BatchCameraProps {
  batch: ScanBatch;
  /** 読み取りを終えて確認画面へ進む */
  onDone: () => void;
  onClose: () => void;
}

/**
 * カメラを開いたまま商品のバーコードを次々に読み取る。
 * シャッターでその場の映像から成分表示を撮ると、写っている商品をまとめて読み取って加える。
 */
export function BatchCamera({ batch, onDone, onClose }: BatchCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const { feedback, detectorSupported, track } = useBarcodeCamera(videoRef, {
    continuous: true,
    onScan: (code) => {
      setLastId(batch.addBarcode(code).id);
    },
    onError: onClose,
  });
  const lastItem = batch.items.find((item) => item.id === lastId);
  const count = batch.items.length;

  return (
    <CameraShell
      title="まとめてスキャン"
      hint={
        detectorSupported
          ? 'バーコードを次々かざす／成分表示はシャッターで撮影か画像を選択'
          : 'このブラウザはバーコード検出に非対応です。番号入力か撮影を使ってください'
      }
      onClose={onClose}
    >
      <Viewfinder
        videoRef={videoRef}
        track={track}
        className={cn(feedback && SCAN_FEEDBACK_CLASS[feedback])}
        guide="barcode"
        shutterLabel="成分表示を撮影"
        onCapture={(dataUrl) => {
          setLastId(null);
          void batch.addPhoto(dataUrl);
        }}
      />

      <LastScanLine item={lastItem} count={count} />
      <BatchTray items={batch.items} highlightId={lastId} />

      {manualOpen || !detectorSupported ? (
        <ManualBarcodeForm
          className="[&_input]:border-white/30 [&_input]:text-white"
          submitLabel="追加"
          onSubmit={(code) => {
            setLastId(batch.addBarcode(code).id);
          }}
        />
      ) : (
        <button
          type="button"
          className="mx-auto flex items-center gap-1.5 text-xs text-white/60"
          onClick={() => {
            setManualOpen(true);
          }}
        >
          <Keyboard className="size-3.5" /> 読み取れないときは番号を入力
        </button>
      )}

      <Button
        size="lg"
        className="h-12 w-full bg-white text-base text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white"
        disabled={count === 0}
        onClick={onDone}
      >
        {count === 0 ? 'まだ商品がありません' : `${count}品を確認`}
        {count > 0 && <ArrowRight />}
      </Button>
    </CameraShell>
  );
}

/** 未登録の商品の成分表示を 1 枚撮る。 */
export function PhotoCamera({
  onCapture,
  onClose,
}: {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { track } = useBarcodeCamera(videoRef, {
    detect: false,
    onError: onClose,
  });

  return (
    <CameraShell
      title="成分表示を撮影"
      hint="栄養成分表示が枠に収まるように撮るか、右下から画像を選んでください"
      onClose={onClose}
    >
      <Viewfinder
        videoRef={videoRef}
        track={track}
        guide="label"
        shutterLabel="撮影"
        onCapture={onCapture}
      />
    </CameraShell>
  );
}

/** photo: カメラで静止画を撮る / frame: 映っている映像のフレームを切り出す */
type CaptureMode = 'photo' | 'frame';

const CAPTURE_MODE_KEY = 'pfc_capture_mode';
const CAPTURE_MODE_LABEL: Record<CaptureMode, string> = {
  photo: '写真',
  frame: '映像',
};

function readCaptureMode(): CaptureMode {
  return localStorage.getItem(CAPTURE_MODE_KEY) === 'frame' ? 'frame' : 'photo';
}

function CameraShell({
  title,
  hint,
  onClose,
  children,
}: {
  title: string;
  hint: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // 親に backdrop-filter などがあると fixed の基準がずれるため body 直下に描画する
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black text-white">
      <div className="mx-auto flex h-full max-w-md flex-col gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{title}</h2>
            <p className="text-xs text-white/60">{hint}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="閉じる"
          >
            <X className="size-6" />
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Viewfinder({
  videoRef,
  track,
  guide,
  shutterLabel,
  onCapture,
  className,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  track: MediaStreamTrack | null;
  /** 狙いやすいよう出す目安の枠。検出は画面全体から行う */
  guide: 'barcode' | 'label';
  shutterLabel: string;
  onCapture: (dataUrl: string) => void;
  className?: string;
}) {
  // 撮影したことが分かるよう画面を一瞬白くする。key を変えてアニメーションを再生する
  const [flashKey, setFlashKey] = useState(0);
  const [mode, setMode] = useState(readCaptureMode);
  const [taking, setTaking] = useState(false);
  const canTakePhoto = track !== null && supportsTakePhoto();
  const pickerRef = useRef<HTMLInputElement | null>(null);

  const pick = async ([file]: File[]) => {
    if (!file) return;
    try {
      onCapture(await imageToDataUrl(file));
    } catch (error) {
      toast.fromError('画像の読み込みに失敗しました', error);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      toast.info('カメラの準備中です');
      return;
    }
    setFlashKey((key) => key + 1);
    vibrate(20);
    try {
      if (canTakePhoto && mode === 'photo') {
        setTaking(true);
        onCapture(await takePhoto(track));
      } else {
        onCapture(captureVideoFrame(video));
      }
    } catch (error) {
      toast.fromError('撮影に失敗しました', error);
    } finally {
      setTaking(false);
    }
  };

  return (
    <div
      className={cn(
        'relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-neutral-900 transition-shadow',
        className,
      )}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        muted
        playsInline
      />
      <div
        className={cn(
          'pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-white/80',
          guide === 'barcode'
            ? 'top-[42%] h-[22%] w-4/5'
            : 'top-[45%] h-3/5 w-4/5 border-dashed',
        )}
      />
      <CameraControls track={track} videoRef={videoRef} />
      {flashKey > 0 && (
        <div
          key={flashKey}
          className="animate-out fade-out pointer-events-none absolute inset-0 bg-white opacity-0 duration-300"
        />
      )}
      {canTakePhoto && (
        <fieldset className="absolute bottom-7 left-3 flex rounded-full bg-black/50 p-0.5 text-[11px]">
          <legend className="sr-only">撮影方法</legend>
          {(['photo', 'frame'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              className={cn(
                'rounded-full px-2.5 py-1',
                mode === value && 'bg-white text-black',
              )}
              onClick={() => {
                setMode(value);
                localStorage.setItem(CAPTURE_MODE_KEY, value);
              }}
            >
              {CAPTURE_MODE_LABEL[value]}
            </button>
          ))}
        </fieldset>
      )}
      <button
        type="button"
        className="absolute right-3 bottom-7 flex size-10 items-center justify-center rounded-full bg-black/50"
        aria-label="保存済みの画像を選ぶ"
        onClick={() => pickerRef.current?.click()}
      >
        <ImagePlus className="size-5" />
      </button>
      <ImageFileInput
        ref={pickerRef}
        onSelect={(files) => {
          void pick(files);
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => {
            void capture();
          }}
          disabled={taking}
          aria-label={shutterLabel}
          className="pointer-events-auto flex size-16 items-center justify-center rounded-full border-4 border-white/60 bg-white text-black shadow-lg transition-transform active:scale-90 disabled:opacity-60"
        >
          {taking ? (
            <Loader2 className="size-7 animate-spin" />
          ) : (
            <Camera className="size-7" />
          )}
        </button>
        <span className="rounded-full bg-black/50 px-2 py-0.5 text-[11px]">
          {shutterLabel}
        </span>
      </div>
    </div>
  );
}

/** 直前に読み取った商品の状態を 1 行で伝える。 */
function LastScanLine({
  item,
  count,
}: {
  item: BatchItem | undefined;
  count: number;
}) {
  let content: ReactNode = (
    <span className="text-white/50">
      {count > 0 ? `${count}品を読み取り済み` : '読み取った商品が下に並びます'}
    </span>
  );
  if (item?.status === 'loading') {
    content = (
      <>
        <Loader2 className="size-4 animate-spin" /> {item.loadingLabel}...
      </>
    );
  } else if (item?.status === 'missing') {
    content = (
      <>
        <CircleAlert className="size-4 text-amber-400" />
        未登録の商品です。確認画面で撮影・入力できます
      </>
    );
  } else if (item?.food) {
    content = (
      <>
        <Check className="size-4 text-green-400" />
        <span className="min-w-0 truncate">{item.food.name}</span>
        {item.quantity > 1 && (
          <span className="shrink-0 font-semibold">×{item.quantity}</span>
        )}
      </>
    );
  }
  return (
    <p className="flex h-5 items-center justify-center gap-1.5 text-sm">
      {content}
    </p>
  );
}

/** 溜まった商品を新しい順に横並びで見せる。 */
function BatchTray({
  items,
  highlightId,
}: {
  items: BatchItem[];
  highlightId: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {[...items].reverse().map((item) => (
        <li
          key={item.id}
          className={cn(
            'flex max-w-[11rem] shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs',
            item.id === highlightId && 'ring-2 ring-green-400',
            item.status === 'missing' && 'bg-amber-500/20 text-amber-200',
          )}
        >
          {item.status === 'loading' && (
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
          )}
          {item.status === 'missing' && (
            <CircleAlert className="size-3.5 shrink-0" />
          )}
          <span className="truncate">
            {item.food?.name ??
              (item.status === 'missing' ? '未登録' : item.loadingLabel)}
          </span>
          {item.quantity !== 1 && (
            <span className="shrink-0 font-semibold">×{item.quantity}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
