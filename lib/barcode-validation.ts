/**
 * GTIN 系(EAN/UPC/ITF)共通の mod10 チェックデジット検証。
 * チェックデジットを除いた末尾の桁から 3,1,3,1... の重みを掛けて合計する。
 */
function hasValidCheckDigit(value: string): boolean {
  if (!/^\d{2,}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  const checkDigit = digits.pop();
  const sum = digits
    .reverse()
    .reduce((acc, digit, i) => acc + digit * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
}

/** UPC-E(8桁) を UPC-A(12桁) に展開する。形式が不正なら null。 */
function expandUpcE(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return null;
  const [numberSystem, d1, d2, d3, d4, d5, last, checkDigit] = value;
  const body =
    last === '0' || last === '1' || last === '2'
      ? `${d1}${d2}${last}0000${d3}${d4}${d5}`
      : last === '3'
        ? `${d1}${d2}${d3}00000${d4}${d5}`
        : last === '4'
          ? `${d1}${d2}${d3}${d4}00000${d5}`
          : `${d1}${d2}${d3}${d4}${d5}0000${last}`;
  return `${numberSystem}${body}${checkDigit}`;
}

const RULES: Partial<Record<BarcodeFormat, (value: string) => boolean>> = {
  ean_13: (v) => v.length === 13 && hasValidCheckDigit(v),
  ean_8: (v) => v.length === 8 && hasValidCheckDigit(v),
  upc_a: (v) => v.length === 12 && hasValidCheckDigit(v),
  upc_e: (v) => {
    const expanded = expandUpcE(v);
    return expanded !== null && hasValidCheckDigit(expanded);
  },
  itf: (v) => v.length % 2 === 0 && hasValidCheckDigit(v),
  code_128: (v) => /^[\x20-\x7E]{6,32}$/.test(v),
  code_39: (v) => /^[0-9A-Z .\-$/+%]{6,32}$/.test(v),
  code_93: (v) => /^[\x20-\x7E]{6,32}$/.test(v),
  codabar: (v) => /^[A-D][0-9\-$:/.+]{4,30}[A-D]$/.test(v),
};

/** 読み取った値がフォーマットの仕様（桁数・文字種・チェックデジット）を満たすか。 */
export function isValidBarcode(value: string, format: BarcodeFormat): boolean {
  const rule = RULES[format];
  return rule ? rule(value) : value.length > 0;
}
