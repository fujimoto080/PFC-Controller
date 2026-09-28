'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageTitle } from '@/components/ui/page-title';
import { StatusMessage } from '@/components/ui/status-message';
import { api } from '@/lib/client/api';
import type { UsageEventKind, UsageSummaryRow } from '@/lib/types';

type LoadState = UsageSummaryRow[] | 'loading' | 'failed';

const SECTIONS: { kind: UsageEventKind; title: string }[] = [
  { kind: 'page', title: '画面' },
  { kind: 'click', title: '操作' },
  { kind: 'swipe', title: 'スワイプ' },
  { kind: 'mcp', title: 'MCP ツール' },
];

export default function UsagePage() {
  const [rows, setRows] = useState<LoadState>('loading');

  useEffect(() => {
    api
      .get<UsageSummaryRow[]>('/api/usage-events')
      .then(setRows)
      .catch((error: unknown) => {
        console.error('利用状況の取得に失敗しました', error);
        setRows('failed');
      });
  }, []);

  return (
    <div className="space-y-6">
      <PageTitle>利用状況</PageTitle>

      {rows === 'loading' ? (
        <StatusMessage>読み込み中...</StatusMessage>
      ) : rows === 'failed' ? (
        <StatusMessage>利用状況の取得に失敗しました</StatusMessage>
      ) : (
        SECTIONS.map(({ kind, title }) => (
          <UsageSection
            key={kind}
            title={title}
            rows={rows.filter((row) => row.kind === kind)}
          />
        ))
      )}
    </div>
  );
}

function UsageSection({
  title,
  rows,
}: {
  title: string;
  rows: UsageSummaryRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">記録はありません</p>
        ) : (
          rows.map(({ name, path, count, lastUsedAt }) => (
            <div
              key={`${name}\n${path}`}
              className="flex items-center gap-3 py-2 text-sm first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate">{name}</div>
                {path !== null && path !== name && (
                  <div className="text-muted-foreground truncate text-xs">
                    {path}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold tabular-nums">{count}回</div>
                <div className="text-muted-foreground text-xs tabular-nums">
                  {format(new Date(lastUsedAt), 'M/d HH:mm')}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
