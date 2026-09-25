import 'server-only';
import { ApiError } from '@/lib/api/handler';
import { assertAiResponseOk, requireAiText } from '@/lib/server/ai-response';

const MODEL = 'gemini-3.8-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

interface GeminiRequest {
  prompt: string;
  temperature: number;
  tools?: { google_search: Record<string, never> }[];
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
  }[];
}

function requireGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ApiError('GEMINI_API_KEY が設定されていません', 500);
  }
  return apiKey;
}

export async function callGemini({
  prompt,
  temperature,
  tools,
}: GeminiRequest): Promise<string> {
  const apiKey = requireGeminiApiKey();
  const body = {
    contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
    generationConfig: { temperature },
    ...(tools ? { tools } : {}),
  };

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  await assertAiResponseOk(response, 'Gemini');

  const result = (await response.json()) as GeminiResponse;
  // Google 検索グラウンディング時などはテキストが複数 part に分割されることがある
  return requireAiText(
    result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join(''),
  );
}
