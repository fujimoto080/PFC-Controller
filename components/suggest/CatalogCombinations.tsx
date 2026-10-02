'use client';

import { useState } from 'react';
import { Loader2, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CombinationSuggestions } from '@/lib/catalog/types';
import { api } from '@/lib/client/api';
import { MEAL_SLOTS, slotForTime } from '@/lib/meal-schedule';
import { toast } from '@/lib/toast';
import type { MealSlot } from '@/lib/types';
import { SuggestionOptionCard } from './SuggestionOptionCard';

/**
 * お店の商品から、公式の栄養成分でこの食事の目安に近い組み合わせを AI なしですぐに出す。
 * コンビニはメーカーの既製品も組み合わせる。
 */
export function CatalogCombinations({
  sources,
}: {
  sources: { id: string; name: string }[];
}) {
  const [sourceId, setSourceId] = useState('');
  const [slot, setSlot] = useState<MealSlot>(() => slotForTime(Date.now()));
  const [result, setResult] = useState<CombinationSuggestions>();
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      setResult(
        await api.get<CombinationSuggestions>(
          `/api/combination-suggestions?store=${encodeURIComponent(sourceId)}&slot=${slot}`,
        ),
      );
    } catch (error) {
      toast.fromError('組み合わせを出せませんでした', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>お店の商品から組み合わせる（AI なし）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger className="min-w-0 flex-1">
              <SelectValue placeholder="お店" />
            </SelectTrigger>
            <SelectContent>
              {sources.map(({ id, name }) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={slot}
            onValueChange={(value) => {
              setSlot(value as MealSlot);
            }}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEAL_SLOTS.map(({ slot: value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          className="w-full"
          disabled={!sourceId || loading}
          onClick={() => {
            void search();
          }}
        >
          {loading ? <Loader2 className="animate-spin" /> : <ListChecks />}
          組み合わせを出す
        </Button>

        {result &&
          (result.combinations.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-sm">
              今日の残りに収まる組み合わせはありません。
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-muted-foreground text-xs">
                1食の目安 {Math.round(result.target.calories)}kcal P
                {Math.round(result.target.protein)} F
                {Math.round(result.target.fat)} C
                {Math.round(result.target.carbs)}
              </p>
              {result.combinations.map(({ items, total, price }) => (
                <SuggestionOptionCard
                  key={items.map((item) => item.id).join()}
                  option={{
                    store: result.store,
                    items: items.map(
                      ({ name, maker, protein, fat, carbs, calories }) => ({
                        name: maker ? `${name}（${maker}）` : name,
                        protein,
                        fat,
                        carbs,
                        calories,
                      }),
                    ),
                    total,
                    reason:
                      price === undefined
                        ? '公式の栄養成分から選んだ組み合わせ'
                        : `税込 ${price.toLocaleString()} 円・公式の栄養成分から選んだ組み合わせ`,
                    hasNewProduct: false,
                  }}
                />
              ))}
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
