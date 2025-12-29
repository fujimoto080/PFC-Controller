import { PFCStats } from "@/components/dashboard/PFCStats"

export default function Home() {
  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center py-2">
        <h1 className="text-2xl font-bold tracking-tight">今日のバランス</h1>
        <div className="w-8 h-8 rounded-full bg-secondary" /> {/* Placeholder for user avatar or date logic */}
      </header>

      <PFCStats />

      {/* Placeholder for Recent Entries */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">最近の記録</h2>
        <div className="text-sm text-muted-foreground text-center py-10 bg-secondary/20 rounded-lg border border-dashed">
          今日の記録はありません。「追加」ボタンから記録しましょう。
        </div>
      </div>
    </div>
  )
}
