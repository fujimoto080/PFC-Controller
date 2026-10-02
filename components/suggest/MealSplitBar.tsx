'use client';

import { useRef } from 'react';
import { splitSegments } from '@/lib/meal-split';
import type { MealSlot, MealSplit } from '@/lib/types';
import { cn } from '@/lib/utils';

type Boundary = keyof MealSplit;

const BOUNDARIES: { key: Boundary; label: string }[] = [
  { key: 'breakfastEnd', label: '朝と昼の境目' },
  { key: 'lunchEnd', label: '昼と夜の境目' },
];

const SLOT_COLORS: Record<MealSlot, string> = {
  breakfast: 'bg-amber-400/70',
  lunch: 'bg-sky-400/70',
  dinner: 'bg-indigo-400/70',
};

const KEY_STEP = 1;
const KEY_STEP_LARGE = 5;

/** 境目の位置（%）を、隣の境目を越えない範囲に収める。 */
function moveBoundary(
  split: MealSplit,
  key: Boundary,
  value: number,
): MealSplit {
  const min = key === 'lunchEnd' ? split.breakfastEnd : 0;
  const max = key === 'breakfastEnd' ? split.lunchEnd : 100;
  return { ...split, [key]: Math.min(max, Math.max(min, Math.round(value))) };
}

/**
 * 1 本のバーを朝・昼・晩に分ける、2 本の線を動かす入力。
 * totalCalories（1日の上限）を配分で分けた kcal を各区間に出す。
 */
export function MealSplitBar({
  split,
  totalCalories,
  onChange,
}: {
  split: MealSplit;
  totalCalories: number;
  onChange: (split: MealSplit) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);

  const dragTo = (key: Boundary, clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    onChange(
      moveBoundary(split, key, ((clientX - rect.left) / rect.width) * 100),
    );
  };

  return (
    <div ref={barRef} className="relative flex h-12 select-none">
      {splitSegments(split).map(({ slot, label, share }, index) => (
        <div
          key={slot}
          className={cn(
            'flex min-w-0 flex-col items-center justify-center overflow-hidden text-[11px] leading-tight',
            SLOT_COLORS[slot],
            index === 0 && 'rounded-l-md',
            index === 2 && 'rounded-r-md',
          )}
          style={{ width: `${share}%` }}
        >
          <span className="font-semibold">{label.replace('ごはん', '')}</span>
          <span className="tabular-nums">
            {Math.round((totalCalories * share) / 100)}
          </span>
        </div>
      ))}
      {BOUNDARIES.map(({ key, label }) => (
        <div
          key={key}
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 2 本の線を 1 本のバー上で動かすため input[type=range] では位置を揃えられない
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={split[key]}
          aria-valuetext={`${split[key]}%`}
          className="focus-visible:ring-ring/50 absolute inset-y-0 flex w-8 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded-md outline-none focus-visible:ring-[3px]"
          style={{ left: `${split[key]}%` }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              dragTo(key, event.clientX);
            }
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
            const delta =
              event.key === 'ArrowLeft' || event.key === 'ArrowDown'
                ? -step
                : event.key === 'ArrowRight' || event.key === 'ArrowUp'
                  ? step
                  : 0;
            if (delta === 0) return;
            event.preventDefault();
            onChange(moveBoundary(split, key, split[key] + delta));
          }}
        >
          <span className="bg-foreground h-full w-1 rounded-full shadow" />
        </div>
      ))}
    </div>
  );
}
