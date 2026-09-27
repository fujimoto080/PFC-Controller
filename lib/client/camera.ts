// カメラのピント・ズーム・ライトの制御。対応していない端末・ブラウザでは何もしない。

/** その端末のカメラが指定したピントのモードに対応しているか。 */
export function supportsFocusMode(
  track: MediaStreamTrack,
  mode: 'continuous' | 'single-shot',
): boolean {
  return track.getCapabilities().focusMode?.includes(mode) ?? false;
}

/** 対応していれば、被写体に合わせてピントを合わせ続けるモードにする。 */
export async function setContinuousFocus(
  track: MediaStreamTrack,
): Promise<void> {
  if (!supportsFocusMode(track, 'continuous')) return;
  await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
}

/**
 * 画面上の位置を、映像フレーム内の 0〜1 の座標に変換する。
 * video は object-cover で表示しているため、はみ出して切り取られた分を考慮する。
 */
export function toVideoPoint(
  video: HTMLVideoElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = video.getBoundingClientRect();
  const scale = Math.max(
    rect.width / video.videoWidth,
    rect.height / video.videoHeight,
  );
  const width = video.videoWidth * scale;
  const height = video.videoHeight * scale;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return {
    x: clamp((clientX - rect.left - (rect.width - width) / 2) / width),
    y: clamp((clientY - rect.top - (rect.height - height) / 2) / height),
  };
}
