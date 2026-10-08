import { MACROS } from '@/lib/macros';
import type { PFC } from '@/lib/types';
import { cn } from '@/lib/utils';

/** カロリーと P/F/C を 4 つのタイルで大きく見せる。 */
export function NutrientTiles({ pfc }: { pfc: PFC }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      <NutrientTile
        label="kcal"
        value={pfc.calories}
        className="bg-primary text-primary-foreground"
      />
      {MACROS.map(({ key, short }) => (
        <NutrientTile
          key={key}
          label={`${short} (g)`}
          value={pfc[key]}
          className="bg-muted"
        />
      ))}
    </div>
  );
}

function NutrientTile({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={cn('rounded-lg px-1 py-2', className)}>
      <p className="text-lg leading-tight font-bold tabular-nums">{value}</p>
      <p className="text-[10px] opacity-70">{label}</p>
    </div>
  );
}
