import 'server-only';
import { ApiError } from '@/lib/api/handler';

const REPOSITORY = 'fujimoto080/PFC-Controller';

/** アプリのリポジトリに GitHub Issue を起票し、その URL を返す。 */
export async function createGitHubIssue(input: {
  title: string;
  body: string;
}): Promise<string> {
  const token = process.env.GITHUB_ISSUE_TOKEN?.trim();
  if (!token) {
    throw new ApiError('GITHUB_ISSUE_TOKEN が設定されていません', 500);
  }
  const response = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/issues`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    console.error('[GitHub Issue] 起票に失敗', response.status);
    throw new ApiError('Issue の起票に失敗しました', 502);
  }
  const issue = (await response.json()) as { html_url: string };
  return issue.html_url;
}
