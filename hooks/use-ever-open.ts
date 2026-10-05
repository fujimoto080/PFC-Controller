import { useState } from 'react';

/** 一度でも open になったら true を返し続ける。シートを初めて開くまで遅延読み込みし、閉じるアニメーションのために以降は載せたままにする。 */
export function useEverOpen(open: boolean): boolean {
  const [everOpen, setEverOpen] = useState(open);
  if (open && !everOpen) setEverOpen(true);
  return everOpen;
}
