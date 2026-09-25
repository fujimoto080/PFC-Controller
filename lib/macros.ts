import type { PFC } from './types';

export type PfcKey = keyof PFC;

export const PFC_KEYS = [
  'protein',
  'fat',
  'carbs',
  'calories',
] as const satisfies readonly PfcKey[];

/** P/F/C 3 栄養素の表示用メタデータ。画面間で色・ラベルを揃えるために共通化する。 */
export const MACROS = [
  {
    key: 'protein',
    label: 'タンパク質',
    short: 'P',
    barClass: 'bg-blue-500',
  },
  {
    key: 'fat',
    label: '脂質',
    short: 'F',
    barClass: 'bg-yellow-500',
  },
  {
    key: 'carbs',
    label: '炭水化物',
    short: 'C',
    barClass: 'bg-green-500',
  },
] as const satisfies readonly {
  key: Exclude<PfcKey, 'calories'>;
  label: string;
  short: string;
  barClass: string;
}[];
