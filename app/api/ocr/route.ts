import { NextRequest, NextResponse } from 'next/server';

interface GeminiInlineDataPart {
  inline_data: {
    mime_type: string;
    data: string;
  };
}

interface GeminiTextPart {
  text: string;
}

interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

interface GeminiRequestBody {
  contents: Array<{
    role: 'user';
    parts: Array<GeminiTextPart | GeminiInlineDataPart>;
  }>;
  generationConfig: {
    temperature: number;
  };
}

const MODEL_NAME = 'gemini-2.0-flash';

function parseDataUrl(imageDataUrl: string): {
  mimeType: string;
  base64Data: string;
} {
  const match = imageDataUrl.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/,
  );
  if (!match) {
    throw new Error('画像データの形式が不正です');
  }

  return {
    mimeType: match[1],
    base64Data: match[2],
  };
}

export async function POST(request: NextRequest) {
  const { imageDataUrl }: { imageDataUrl?: string } = await request.json();

  if (!imageDataUrl?.trim()) {
    return NextResponse.json(
      { error: '画像データが指定されていません' },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY が設定されていません' },
      { status: 500 },
    );
  }

  try {
    const { mimeType, base64Data } = parseDataUrl(imageDataUrl.trim());
    const requestBody: GeminiRequestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                'この画像から読み取れる文字を抽出してください。',
                '返答は抽出結果のテキストのみで、説明文は不要です。',
                '文字がない場合は空文字を返してください。',
              ].join('\n'),
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
      },
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
      console.error('Gemini OCR API error:', errorText);
      return NextResponse.json({ error: 'OCRに失敗しました' }, { status: 502 });
    }

    const result: GeminiResponse = await response.json();
    const text =
      result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Error in POST /api/ocr:', error);
    return NextResponse.json(
      { error: 'OCR処理中にエラーが発生しました' },
      { status: 500 },
    );
  }
}
