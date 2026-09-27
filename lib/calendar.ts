import { formatTime } from '@/lib/utils';

/** Google Calendar API（events.list）の予定のうち、提案に使う項目。 */
export interface CalendarEvent {
  summary?: string;
  location?: string;
  status?: string;
  /** 終日予定は date、時刻付きの予定は dateTime が入る */
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

/** 今日の予定を AI に渡す箇条書きにする。now より前に終わった予定には（終了）を付ける。 */
export function describeCalendarEvents(
  events: CalendarEvent[],
  now: number,
): string[] {
  return events
    .filter((event) => event.status !== 'cancelled')
    .map((event) => {
      // 無題の予定では Google は summary を省く
      const title = event.summary ?? '（タイトルなし）';
      const place = event.location ? `（場所: ${event.location}）` : '';
      const start = event.start?.dateTime;
      const end = event.end?.dateTime;
      if (!start || !end) return `- 終日 ${title}${place}`;
      const endMs = new Date(end).getTime();
      const done = endMs <= now ? '（終了）' : '';
      return `- ${formatTime(new Date(start).getTime())}〜${formatTime(endMs)} ${title}${place}${done}`;
    });
}
