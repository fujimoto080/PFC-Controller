'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SportIcon } from '@/components/SportIcon';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveSports } from '@/lib/client/actions';
import { useAppState } from '@/lib/client/store';

/** スポーツと消費の単位 METs の登録。強度と時間は今日画面で記録のたびに指定し、消費分がその日の上限に加算される。 */
export function SportSettingsPanel() {
  const { sports } = useAppState();
  const [name, setName] = useState('');
  const [metsInput, setMetsInput] = useState('');

  const trimmedName = name.trim();
  const mets = Number(metsInput);
  const canAdd = trimmedName !== '' && Number.isFinite(mets) && mets > 0;

  const handleAdd = async () => {
    if (!canAdd) return;
    const ok = await saveSports([
      ...sports,
      { id: crypto.randomUUID(), name: trimmedName, mets },
    ]);
    if (ok) {
      setName('');
      setMetsInput('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>スポーツ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleAdd();
          }}
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="sport-name">スポーツ名</Label>
            <Input
              id="sport-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              placeholder="例: 水泳"
            />
          </div>
          <div className="w-24 space-y-1.5">
            <Label htmlFor="sport-mets">METs</Label>
            <Input
              id="sport-mets"
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.1}
              value={metsInput}
              onChange={(e) => {
                setMetsInput(e.target.value);
              }}
              placeholder="8"
            />
          </div>
          <Button type="submit" disabled={!canAdd}>
            登録
          </Button>
        </form>
        <p className="text-muted-foreground text-xs">
          METs は運動の強さの指標です（例: ウォーキング 3.5、ジョギング 7）。
        </p>

        {sports.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {sports.map((sport) => (
              <li
                key={sport.id}
                className="flex items-center gap-3 px-3 py-1.5"
              >
                <SportIcon
                  name={sport.name}
                  className="text-muted-foreground size-4 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {sport.name}
                </span>
                <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                  {sport.mets} METs
                </span>
                <IconButton
                  aria-label={`${sport.name}を削除`}
                  data-track="スポーツを削除"
                  onClick={() => {
                    void saveSports(sports.filter((s) => s.id !== sport.id));
                  }}
                >
                  <X />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
