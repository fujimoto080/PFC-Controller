import 'server-only';
import { ApiError } from '@/lib/api/handler';

const MODEL = 'gemini-3.8-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiRequest {
  parts: GeminiPart[];
  temperature?: number;
  tools?: { google_search: Record<string, never> }[];
  allowEmptyResponse?: boolean;
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
  parts,
  temperature = 0,
  tools,
  allowEmptyResponse = false,
}: GeminiRequest): Promise<string> {
  const apiKey = requireGeminiApiKey();
  const body = {
    contents: [{ role: 'user' as const, parts }],
    generationConfig: { temperature },
    ...(tools ? { tools } : {}),
  };

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', errorText);
    throw new ApiError('AI 呼び出しに失敗しました', 502);
  }

  const result = (await response.json()) as GeminiResponse;
  // Google 検索グラウンディング時などはテキストが複数 part に分割されることがある
  const text = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('');
  if (!text) {
    if (allowEmptyResponse) return '';
    throw new ApiError('AI の出力を取得できませんでした', 502);
  }
  return text;
}
