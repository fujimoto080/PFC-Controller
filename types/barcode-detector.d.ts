// Shape Detection API の BarcodeDetector（TypeScript 標準の lib.dom に未収録）
// https://wicg.github.io/shape-detection-api/#barcode-detection-api

type BarcodeFormat =
  | 'aztec'
  | 'code_128'
  | 'code_39'
  | 'code_93'
  | 'codabar'
  | 'data_matrix'
  | 'ean_13'
  | 'ean_8'
  | 'itf'
  | 'pdf417'
  | 'qr_code'
  | 'upc_a'
  | 'upc_e'
  | 'unknown';

interface DetectedBarcode {
  rawValue: string;
  format: BarcodeFormat;
  boundingBox: DOMRectReadOnly;
}

declare class BarcodeDetector {
  constructor(options?: { formats?: BarcodeFormat[] });
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
}
