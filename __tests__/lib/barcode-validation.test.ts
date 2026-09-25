import { Html5QrcodeSupportedFormats as Format } from 'html5-qrcode';
import { isValidBarcode } from '@/lib/barcode-validation';

describe('isValidBarcode', () => {
  it.each([
    [Format.EAN_13, '4901234567894', true],
    [Format.EAN_13, '4901234567890', false],
    [Format.EAN_13, '490123456789', false],
    [Format.EAN_8, '49123456', true],
    [Format.EAN_8, '49123457', false],
    [Format.UPC_A, '036000291452', true],
    [Format.UPC_A, '036000291453', false],
    [Format.UPC_E, '04252614', true],
    [Format.UPC_E, '04252615', false],
    [Format.ITF, '14901234567891', true],
    [Format.ITF, '1490123456789', false],
    [Format.CODE_39, 'ABC-123', true],
    [Format.CODE_39, 'abc-123', false],
    [Format.CODABAR, 'A12345B', true],
    [Format.QR_CODE, 'https://example.com', true],
    [undefined, '', false],
  ])('%s: %s -> %s', (format, value, expected) => {
    expect(isValidBarcode(value, format)).toBe(expected);
  });
});
