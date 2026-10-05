import { feedbackSchema } from '@/lib/api/schemas';

describe('feedbackSchema', () => {
  it('タイトルと内容があれば前後の空白を除いて通る', () => {
    expect(
      feedbackSchema.parse({ title: ' 不具合 ', body: ' 落ちる ' }),
    ).toEqual({ title: '不具合', body: '落ちる' });
  });

  it('空白だけのタイトル・内容は弾く', () => {
    expect(feedbackSchema.safeParse({ title: ' ', body: 'x' }).success).toBe(
      false,
    );
    expect(feedbackSchema.safeParse({ title: 'x', body: ' ' }).success).toBe(
      false,
    );
  });

  it('長すぎるタイトル・内容は弾く', () => {
    expect(
      feedbackSchema.safeParse({ title: 'a'.repeat(101), body: 'x' }).success,
    ).toBe(false);
    expect(
      feedbackSchema.safeParse({ title: 'x', body: 'a'.repeat(2001) }).success,
    ).toBe(false);
  });
});
