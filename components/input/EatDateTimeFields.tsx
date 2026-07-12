'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EatDateTimeFieldsProps {
  eatDate: string;
  setEatDate: (value: string) => void;
  eatTime: string;
  setEatTime: (value: string) => void;
}

/** 「食べた日付 / 時刻」の 2 列入力グリッド。useEatDateTime と組み合わせて使う。 */
export function EatDateTimeFields({
  eatDate,
  setEatDate,
  eatTime,
  setEatTime,
}: EatDateTimeFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="eatDate">食べた日付</Label>
        <Input
          id="eatDate"
          type="date"
          value={eatDate}
          onChange={(e) => setEatDate(e.target.value)}
          onClick={(e) => e.currentTarget.showPicker?.()}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="eatTime">時刻</Label>
        <Input
          id="eatTime"
          type="time"
          value={eatTime}
          onChange={(e) => setEatTime(e.target.value)}
          onClick={(e) => e.currentTarget.showPicker?.()}
        />
      </div>
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
