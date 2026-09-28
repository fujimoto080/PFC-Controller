'use client';

// AI に送る写真は長辺をこの大きさまで縮める。成分表示の小さな文字が読める程度を保ちつつ、
// 通信量と API のリクエストサイズ上限を抑える。
const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.85;

function drawToDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
): string {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('画像の変換に失敗しました');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('画像の読み込みに失敗しました'));
    };
    reader.onerror = () => {
      reject(new Error('画像の読み込みに失敗しました'));
    };
    reader.readAsDataURL(file);
  });
}

/** 写真ファイルを縮小した JPEG の dataURL にする。縮小できない形式はそのまま読む。 */
export async function imageToDataUrl(file: Blob): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return readAsDataUrl(file);
  }
  try {
    return drawToDataUrl(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/** 再生中のカメラ映像の今のフレームを dataURL にする。 */
export function captureVideoFrame(video: HTMLVideoElement): string {
  return drawToDataUrl(video, video.videoWidth, video.videoHeight);
}

/** 映像のフレームではなく、カメラで静止画を撮れる（ImageCapture に対応している）か。 */
export function supportsTakePhoto(): boolean {
  return typeof ImageCapture !== 'undefined';
}

/**
 * カメラで静止画を撮って dataURL にする。映像のフレームより高解像度で、撮影用のピント合わせも効く。
 */
export async function takePhoto(track: MediaStreamTrack): Promise<string> {
  return imageToDataUrl(await new ImageCapture(track).takePhoto());
}
