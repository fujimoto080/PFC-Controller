import { PFCStats } from '@/components/dashboard/PFCStats';
import { WeeklyPFCStats } from '@/components/dashboard/WeeklyPFCStats';

export default function Home() {
  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between py-2">
        <h1 className="text-2xl font-bold tracking-tight">今日のバランス</h1>
        <div className="bg-secondary h-8 w-8 rounded-full" />{' '}
        {/* Placeholder for user avatar or date logic */}
      </header>

      <PFCStats />
      <WeeklyPFCStats />

      {/* Placeholder for Recent Entries */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">最近の記録</h2>
        <div className="text-muted-foreground bg-secondary/20 rounded-lg border border-dashed py-10 text-center text-sm">
          今日の記録はありません。「追加」ボタンから記録しましょう。
        </div>
      </div>
    </div>
  );
}
