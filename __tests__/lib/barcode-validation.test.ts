import { isValidBarcode } from '@/lib/barcode-validation';

describe('isValidBarcode', () => {
  it.each<[BarcodeFormat, string, boolean]>([
    ['ean_13', '4901234567894', true],
    ['ean_13', '4901234567890', false],
    ['ean_13', '490123456789', false],
    ['ean_8', '49123456', true],
    ['ean_8', '49123457', false],
    ['upc_a', '036000291452', true],
    ['upc_a', '036000291453', false],
    ['upc_e', '04252614', true],
    ['upc_e', '04252615', false],
    ['itf', '14901234567891', true],
    ['itf', '1490123456789', false],
    ['code_39', 'ABC-123', true],
    ['code_39', 'abc-123', false],
    ['codabar', 'A12345B', true],
    ['qr_code', 'https://example.com', true],
    ['qr_code', '', false],
  ])('%s: %s -> %s', (format, value, expected) => {
    expect(isValidBarcode(value, format)).toBe(expected);
  });
});
