import { Calendar } from '@/components/calendar/Calendar';

export const metadata = {
    title: '月間サマリー | PFC Balance',
    description: '月間の摂取カロリーのサマリーを表示します',
};

export default function CalendarPage() {
    return (
        <div className="pb-8">
            <header className="mb-6 flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">カレンダー</h1>
                <p className="text-muted-foreground text-sm">
                    月間の摂取カロリーを確認できます
                </p>
            </header>

            <Calendar />
        </div>
    );
}
