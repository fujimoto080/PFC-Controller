import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/handler';
import { feedbackSchema } from '@/lib/api/schemas';
import { createGitHubIssue } from '@/lib/server/github-issues';

export const POST = defineRoute(
  { label: 'フィードバックの送信', auth: true, body: feedbackSchema },
  async (_req, { body }) => {
    const url = await createGitHubIssue(body);
    return NextResponse.json({ url });
  },
);
