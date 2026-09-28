'use client';

import { useLayoutEffect, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { trackUsage } from '@/lib/client/usage';

// 指に対して画面をどれだけ動かすか
const DRAG_RATIO = 0.6;
const EXIT_MS = 120;
const ENTER_MS = 260;
// 切り替え時に画面幅の何割ぶん横から入ってくるか
const SLIDE_PERCENT = 35;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 左スワイプで翌日、右スワイプで前日へ移る。横スクロール領域（data-swipe-ignore）内のスワイプは無視する。
 * スワイプ中は内容を指に追従させ、日付が変わったら（ボタン操作も含め）進んだ向きから内容をスライドさせる。
 */
export function useDaySwipe(date: string, onShift: (days: 1 | -1) => void) {
  const contentRef = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const offset = useRef(0);
  const prevDate = useRef(date);

  const play = (keyframes: Keyframe[], duration: number) => {
    const el = contentRef.current;
    if (!el) return null;
    animation.current?.cancel();
    el.style.transform = '';
    el.style.opacity = '';
    animation.current = el.animate(keyframes, {
      duration,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      fill: 'forwards',
    });
    return animation.current;
  };

  const setDrag = (x: number) => {
    const el = contentRef.current;
    if (!el) return;
    animation.current?.cancel();
    offset.current = x;
    el.style.transform = x === 0 ? '' : `translateX(${x}px)`;
    el.style.opacity =
      x === 0 ? '' : String(1 - Math.min(Math.abs(x) / 600, 0.3));
  };

  useLayoutEffect(() => {
    const prev = prevDate.current;
    prevDate.current = date;
    if (prev === date) return;
    offset.current = 0;
    if (prefersReducedMotion()) {
      setDrag(0);
      return;
    }
    const from = date > prev ? SLIDE_PERCENT : -SLIDE_PERCENT;
    play(
      [
        { transform: `translateX(${from}%)`, opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      ENTER_MS,
    );
  }, [date]);

  const isIgnored = ({ target }: { target: EventTarget | null }) =>
    (target as Element).closest('[data-swipe-ignore]') !== null;

  const handlers = useSwipeable({
    delta: 50,
    onSwiping: ({ dir, deltaX, event }) => {
      if (prefersReducedMotion() || isIgnored(event)) return;
      setDrag(dir === 'Left' || dir === 'Right' ? deltaX * DRAG_RATIO : 0);
    },
    onSwiped: ({ dir, event }) => {
      if (dir !== 'Left' && dir !== 'Right') return;
      if (isIgnored(event)) return;
      const days = dir === 'Left' ? 1 : -1;
      trackUsage('swipe', days === 1 ? '翌日へ' : '前日へ');
      if (prefersReducedMotion()) {
        onShift(days);
        return;
      }
      const exit = play(
        [
          { transform: `translateX(${offset.current}px)` },
          { transform: `translateX(${-days * SLIDE_PERCENT}%)`, opacity: 0 },
        ],
        EXIT_MS,
      );
      offset.current = 0;
      // 途中で次の操作に割り込まれても日付は進める
      const shift = () => {
        onShift(days);
      };
      if (exit) void exit.finished.then(shift, shift);
      else shift();
    },
    onTouchEndOrOnMouseUp: () => {
      // 日付を変えるほど動かさなかったときは元の位置へ戻す
      if (offset.current === 0) return;
      const from = offset.current;
      offset.current = 0;
      play(
        [
          { transform: `translateX(${from}px)` },
          { transform: 'translateX(0)' },
        ],
        ENTER_MS,
      );
    },
  });

  return { contentRef, handlers };
}
