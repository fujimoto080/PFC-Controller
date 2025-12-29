import { PFCStats } from "@/components/dashboard/PFCStats"

export default function Home() {
  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center py-2">
        <h1 className="text-2xl font-bold tracking-tight">Today's Balance</h1>
        <div className="w-8 h-8 rounded-full bg-secondary" /> {/* Placeholder for user avatar or date logic */}
      </header>

      <PFCStats />

      {/* Placeholder for Recent Entries */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Recent Entries</h2>
        <div className="text-sm text-muted-foreground text-center py-10 bg-secondary/20 rounded-lg border border-dashed">
          No entries today. Tap "Add" to start.
        </div>
      </div>
    </div>
  )
}
