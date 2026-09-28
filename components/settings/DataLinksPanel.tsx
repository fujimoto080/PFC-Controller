import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const LINKS = [
  { href: '/foods', label: '食品リスト' },
  { href: '/barcodes', label: 'バーコード一覧' },
] as const;

export function DataLinksPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>登録データ</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="hover:text-primary flex items-center justify-between py-3 text-sm first:pt-0 last:pb-0"
          >
            {label}
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
