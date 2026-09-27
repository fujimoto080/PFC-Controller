'use client';

import { useEffect, useState } from 'react';

interface VisibleViewport {
  /** 画面下端からキーボード上端までの高さ (px) */
  keyboardInset: number;
  /** キーボードを除いた見えている領域の高さ (px) */
  height: number;
}

const INPUT_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

const readVisibleViewport = (): VisibleViewport | null => {
  const visual =
    typeof window === 'undefined' ? undefined : window.visualViewport;
  if (!visual) return null;
  const keyboardInset = Math.max(
    0,
    window.innerHeight - visual.height - visual.offsetTop,
  );
  return keyboardInset > 0 ? { keyboardInset, height: visual.height } : null;
};

/**
 * ソフトウェアキーボードを除いた、実際に見えている表示領域を返す。キーボードが閉じているときは null。
 * キーボードの開閉で表示領域が縮んだら、フォーカス中の入力欄が隠れないようスクロールする。
 */
export function useVisibleViewport(): VisibleViewport | null {
  const [viewport, setViewport] = useState(readVisibleViewport);

  useEffect(() => {
    const visual = window.visualViewport;
    if (!visual) return;

    const update = () => {
      setViewport(readVisibleViewport());
    };
    const handleResize = () => {
      update();
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused.matches(INPUT_SELECTOR)) {
        focused.scrollIntoView({ block: 'nearest' });
      }
    };

    visual.addEventListener('resize', handleResize);
    visual.addEventListener('scroll', update);
    return () => {
      visual.removeEventListener('resize', handleResize);
      visual.removeEventListener('scroll', update);
    };
  }, []);

  return viewport;
}
