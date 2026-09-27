import 'server-only';
import { ApiError } from '@/lib/api/handler';
import { assertAiResponseOk, requireAiText } from '@/lib/server/ai-response';

const ENDPOINT = 'https://api.openai.com/v1/responses';

type InputContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string };

interface OutputText {
  type: string;
  text?: string;
  annotations?: { type: string; url?: string; title?: string }[];
}

interface OpenAIResponse {
  output?: { type: string; content?: OutputText[] }[];
}

export interface Citation {
  title: string;
  url: string;
}

function requireOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ApiError('OPENAI_API_KEY が設定されていません', 500);
  }
  return apiKey;
}

async function callOpenAI(body: {
  model: string;
  reasoning: { effort: 'minimal' | 'low' | 'medium' };
  input: { role: 'user'; content: InputContent[] }[];
  tools?: unknown[];
}): Promise<{ text: string; citations: Citation[] }> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${requireOpenAIApiKey()}`,
    },
    body: JSON.stringify(body),
  });
  await assertAiResponseOk(response, 'OpenAI');

  const result = (await response.json()) as OpenAIResponse;
  const texts =
    result.output
      ?.filter((item) => item.type === 'message')
      .flatMap((item) => item.content ?? [])
      .filter((content) => content.type === 'output_text') ?? [];
  const citations = new Map<string, Citation>();
  for (const annotation of texts.flatMap((text) => text.annotations ?? [])) {
    if (annotation.type !== 'url_citation' || !annotation.url) continue;
    citations.set(annotation.url, {
      url: annotation.url,
      title: annotation.title ?? annotation.url,
    });
  }
  return {
    text: requireAiText(texts.map((content) => content.text ?? '').join('')),
    citations: [...citations.values()],
  };
}

/** 指示文と画像（data URL）を渡して OpenAI にテキストを生成させる。 */
export async function callOpenAIWithImage({
  prompt,
  imageDataUrl,
}: {
  prompt: string;
  imageDataUrl: string;
}): Promise<string> {
  const { text } = await callOpenAI({
    model: 'gpt-5-nano',
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
  });
  return text;
}

/** Web 検索を使わせて OpenAI にテキストを生成させる。参照した URL も返す。 */
export function callOpenAIWithWebSearch(prompt: string) {
  return callOpenAI({
    model: 'gpt-5-mini',
    // 新商品・栄養値の検索と献立の組み立てにはある程度の推論が要る
    reasoning: { effort: 'low' },
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
    tools: [
      {
        type: 'web_search',
        user_location: {
          type: 'approximate',
          country: 'JP',
          timezone: 'Asia/Tokyo',
        },
      },
    ],
  });
}
