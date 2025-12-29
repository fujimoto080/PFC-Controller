import { LogList } from '@/components/history/LogList';

export default function LogPage() {
  return (
    <div className="space-y-6">
      <header className="py-2">
        <h1 className="text-2xl font-bold tracking-tight">今日の履歴</h1>
      </header>
      <LogList />
    </div>
  );
}
