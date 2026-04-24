import 'server-only';
import { ApiError } from './handler';

const ENDPOINT = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

export interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

export interface GeminiRequest {
  model: string;
  parts: GeminiPart[];
  temperature?: number;
  tools?: Array<{ google_search: Record<string, never> }>;
  allowEmptyResponse?: boolean;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

export function requireGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ApiError('GEMINI_API_KEY が設定されていません', 500);
  }
  return apiKey;
}

export async function callGemini({
  model,
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

  const response = await fetch(ENDPOINT(model, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', errorText);
    throw new ApiError('AI 呼び出しに失敗しました', 502);
  }

  const result = (await response.json()) as GeminiResponse;
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    if (allowEmptyResponse) return '';
    throw new ApiError('AI の出力を取得できませんでした', 502);
  }
  return text;
}
