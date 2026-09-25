import 'server-only';
import { ApiError } from '@/lib/api/handler';
import { assertAiResponseOk, requireAiText } from '@/lib/server/ai-response';

const MODEL = 'gpt-5-nano';
const ENDPOINT = 'https://api.openai.com/v1/responses';

interface OpenAIResponse {
  output?: {
    type: string;
    content?: { type: string; text?: string }[];
  }[];
}

function requireOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ApiError('OPENAI_API_KEY が設定されていません', 500);
  }
  return apiKey;
}

/** 指示文と画像（data URL）を渡して OpenAI にテキストを生成させる。 */
export async function callOpenAIWithImage({
  prompt,
  imageDataUrl,
}: {
  prompt: string;
  imageDataUrl: string;
}): Promise<string> {
  const apiKey = requireOpenAIApiKey();
  const body = {
    model: MODEL,
    // 成分表示の読み取りに推論は不要なので最小にしてコストと待ち時間を抑える
    reasoning: { effort: 'minimal' },
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          { type: 'input_image', image_url: imageDataUrl },
        ],
      },
    ],
  };

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  await assertAiResponseOk(response, 'OpenAI');

  const result = (await response.json()) as OpenAIResponse;
  return requireAiText(
    result.output
      ?.filter((item) => item.type === 'message')
      .flatMap((item) => item.content ?? [])
      .filter((content) => content.type === 'output_text')
      .map((content) => content.text ?? '')
      .join(''),
  );
}
