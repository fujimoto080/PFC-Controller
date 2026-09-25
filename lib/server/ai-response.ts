import 'server-only';
import { ApiError } from '@/lib/api/handler';

/** AI API のエラー応答をアプリのエラーに変換する。 */
export async function assertAiResponseOk(
  response: Response,
  provider: string,
): Promise<void> {
  if (response.ok) return;

  const errorText = await response.text();
  console.error(`${provider} API error:`, errorText);
  // 402: 前払いクレジット切れ、429: レート制限・利用枠超過
  if (response.status === 402 || response.status === 429) {
    throw new ApiError(
      `AI の利用上限に達しています。${provider} API のクレジット・利用枠を確認してください`,
      503,
    );
  }
  throw new ApiError('AI 呼び出しに失敗しました', 502);
}

/** AI の出力テキストが空ならエラーにする。 */
export function requireAiText(text: string | undefined): string {
  if (!text) throw new ApiError('AI の出力を取得できませんでした', 502);
  return text;
}
