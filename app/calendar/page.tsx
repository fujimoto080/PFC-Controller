import { Calendar } from '@/components/calendar/Calendar';
import { PageTitle } from '@/components/ui/page-title';

export const metadata = {
    title: '月間サマリー | PFC Balance',
    description: '月間の摂取カロリーのサマリーを表示します',
};

export default function CalendarPage() {
    return (
        <div className="pb-8">
            <PageTitle>カレンダー</PageTitle>
            <p className="text-muted-foreground text-sm px-4">
                月間の摂取カロリーを確認できます
            </p>

            <Calendar />
        </div>
    );
}
