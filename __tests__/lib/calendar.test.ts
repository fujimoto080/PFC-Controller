import { describeCalendarEvents } from '@/lib/calendar';
import { toJstTimestamp } from '@/lib/utils';

describe('describeCalendarEvents', () => {
  const now = toJstTimestamp('2026-09-27', '12:30');

  it('時刻付きの予定を JST の時刻と場所で書き、終わった予定に印を付ける', () => {
    expect(
      describeCalendarEvents(
        [
          {
            summary: '定例',
            location: '渋谷オフィス',
            start: { dateTime: '2026-09-27T10:00:00+09:00' },
            end: { dateTime: '2026-09-27T11:00:00+09:00' },
          },
          {
            summary: '客先訪問',
            start: { dateTime: '2026-09-27T05:00:00Z' },
            end: { dateTime: '2026-09-27T06:30:00Z' },
          },
        ],
        now,
      ),
    ).toEqual([
      '- 10:00〜11:00 定例（場所: 渋谷オフィス）（終了）',
      '- 14:00〜15:30 客先訪問',
    ]);
  });

  it('終日予定とタイトル無しを扱い、キャンセル済みは除く', () => {
    expect(
      describeCalendarEvents(
        [
          { summary: '休暇', start: { date: '2026-09-27' } },
          {
            start: { dateTime: '2026-09-27T19:00:00+09:00' },
            end: { dateTime: '2026-09-27T20:00:00+09:00' },
          },
          {
            summary: '中止',
            status: 'cancelled',
            start: { date: '2026-09-27' },
          },
        ],
        now,
      ),
    ).toEqual(['- 終日 休暇', '- 19:00〜20:00 （タイトルなし）']);
  });
});
