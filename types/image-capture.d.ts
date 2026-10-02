// Image Capture 仕様のカメラ制御（ピント・ズーム・ライト）のうち、TypeScript 標準の lib.dom に未収録のもの
// https://w3c.github.io/mediacapture-image/#mediatrackcapabilities-section

interface MediaTrackCapabilities {
  focusMode?: string[];
  zoom?: DoubleRange & { step?: number };
  torch?: boolean;
}

interface MediaTrackConstraintSet {
  focusMode?: ConstrainDOMString;
  /** 映像内の注目点。x, y は 0〜1 に正規化した座標 */
  pointsOfInterest?: { x: number; y: number }[];
  zoom?: ConstrainDouble;
  torch?: ConstrainBoolean;
}

interface MediaTrackSettings {
  focusMode?: string;
}
