import { NextRequest, NextResponse } from 'next/server';

interface GeminiCandidate {
  content?: {
    parts?: Array<{
      text?: string;
    }>;
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

interface GeminiRequestBody {
  contents: Array<{
    role: 'user';
    parts: Array<{ text: string }>;
  }>;
  generationConfig: {
    temperature: number;
    responseMimeType: 'application/json';
  };
  tools?: Array<{
    google_search: Record<string, never>;
  }>;
}

interface EstimatedNutrition {
  name: string;
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
  store?: string;
}

const MODEL_NAME = 'gemini-2.0-flash';

function extractJsonObject(rawText: string): string {
  const fencedMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const plainMatch = rawText.match(/\{[\s\S]*\}/);
  if (plainMatch) {
    return plainMatch[0].trim();
  }

  throw new Error('JSON形式の結果を取得できませんでした');
}

function normalizeNutrition(data: Partial<EstimatedNutrition>): EstimatedNutrition {
  const toNumber = (value: unknown) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return 0;
    }
    return Math.round(numeric * 10) / 10;
  };

  return {
    name: (data.name ?? '入力内容').toString().trim() || '入力内容',
    protein: toNumber(data.protein),
    fat: toNumber(data.fat),
    carbs: toNumber(data.carbs),
    calories: toNumber(data.calories),
    store: data.store?.trim() || undefined,
  };
}

export async function POST(request: NextRequest) {
  const { text }: { text?: string } = await request.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: '食べた内容のテキストを入力してください' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY が設定されていません' },
      { status: 500 },
    );
  }

  const prompt = [
    'あなたは栄養計算アシスタントです。',
    'ユーザーが食べた内容を推定し、次のJSONのみを返してください。',
    '{"name":"食品名","protein":0,"fat":0,"carbs":0,"calories":0,"store":"店名または空文字"}',
    '数値は必ず半角数字で、単位はg/kcalです。',
    '不明な値は0を設定してください。説明文やMarkdownは不要です。',
    `入力: ${text.trim()}`,
  ].join('\n');

  try {
    const requestBody: GeminiRequestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
      tools: [{ google_search: {} }],
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return NextResponse.json({ error: 'AIからの栄養推定に失敗しました' }, { status: 502 });
    }

    const result: GeminiResponse = await response.json();
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return NextResponse.json({ error: 'AIの出力を取得できませんでした' }, { status: 502 });
    }

    const parsedJson = JSON.parse(extractJsonObject(generatedText)) as Partial<EstimatedNutrition>;
    const normalized = normalizeNutrition(parsedJson);

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Error in POST /api/ai-nutrition:', error);
    return NextResponse.json({ error: '栄養推定中にエラーが発生しました' }, { status: 500 });
  }
}
