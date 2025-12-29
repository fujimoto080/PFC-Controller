import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header className="py-2">
        <h1 className="text-2xl font-bold tracking-tight">設定</h1>
      </header>

      <div className="flex flex-col gap-4">
        <div className="bg-card text-card-foreground rounded-lg border p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">目標設定</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            現在の目標: 2000 kcal (P:100 F:60 C:250)
          </p>
          <Button variant="outline" className="w-full">
            目標を編集
          </Button>
        </div>

        <div className="bg-card text-card-foreground rounded-lg border p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">データ管理</h2>
          <Button variant="destructive" className="w-full">
            全データを消去
          </Button>
        </div>
      </div>
    </div>
  );
}
