import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const SECTION_STYLES = {
  store: {
    container: '',
    header: 'bg-muted/30 mb-2 rounded px-2 py-1 text-sm font-semibold',
    body: 'space-y-3',
  },
  group: {
    container: 'bg-background space-y-2 rounded-md border p-2',
    header: 'px-1 text-xs font-medium',
    body: 'space-y-2',
  },
} as const;

/** クリックで開閉できる見出し付きセクション。店舗（外側）と店内グループ（内側）の 2 種類の見た目を持つ。 */
export function CollapsibleSection({
  title,
  collapsed,
  onToggle,
  variant,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  variant: keyof typeof SECTION_STYLES;
  children: ReactNode;
}) {
  const styles = SECTION_STYLES[variant];
  const Icon = collapsed ? ChevronRight : ChevronDown;
  return (
    <div className={styles.container}>
      <button
        type="button"
        className={cn(
          'text-muted-foreground flex w-full items-center text-left',
          styles.header,
        )}
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <Icon className="mr-1 h-4 w-4" />
        {title}
      </button>
      {!collapsed && <div className={styles.body}>{children}</div>}
    </div>
  );
}
