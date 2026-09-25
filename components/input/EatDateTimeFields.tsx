'use client';

import type { MouseEvent } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EatDateTime } from '@/hooks/use-eat-datetime';

interface EatDateTimeFieldsProps {
  value: EatDateTime;
  onChange: (value: EatDateTime) => void;
}

const FIELDS = [
  { key: 'date', id: 'eatDate', type: 'date', label: '食べた日付' },
  { key: 'time', id: 'eatTime', type: 'time', label: '時刻' },
] as const;

// showPicker は型上は必須だが未対応ブラウザがあるため任意呼び出しにする。
const openNativePicker = (e: MouseEvent<HTMLInputElement>) => {
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  e.currentTarget.showPicker?.();
};

/** 「食べた日付 / 時刻」の 2 列入力グリッド。useEatDateTime と組み合わせて使う。 */
export function EatDateTimeFields({ value, onChange }: EatDateTimeFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {FIELDS.map(({ key, id, type, label }) => (
        <div key={key} className="space-y-2">
          <Label htmlFor={id}>{label}</Label>
          <Input
            id={id}
            type={type}
            value={value[key]}
            onChange={(e) => {
              onChange({ ...value, [key]: e.target.value });
            }}
            onClick={openNativePicker}
          />
        </div>
      ))}
    </div>
  );
}

/** EatDateTimeFields を muted な Card で包んだもの（記録追加・食品管理ページで共通）。 */
export function EatDateTimeCard(props: EatDateTimeFieldsProps) {
  return (
    <Card className="bg-muted/30">
      <CardContent className="pt-6">
        <EatDateTimeFields {...props} />
      </CardContent>
    </Card>
  );
}
