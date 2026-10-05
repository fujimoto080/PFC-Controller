import { Button } from '@/components/ui/button';

const FACTORS = [0.5, 1, 1.5, 2] as const;

/** 記録する栄養値の倍率を選ぶ。 */
export function QuantitySelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">数量</p>
      <div className="grid grid-cols-4 gap-2">
        {FACTORS.map((factor) => (
          <Button
            key={factor}
            type="button"
            variant={value === factor ? 'default' : 'outline'}
            aria-pressed={value === factor}
            onClick={() => {
              onChange(factor);
            }}
          >
            ×{factor}
          </Button>
        ))}
      </div>
    </div>
  );
}
