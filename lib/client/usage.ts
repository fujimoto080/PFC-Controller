import type { UsageEventInput } from '@/lib/types';

/** 利用状況として記録する操作対象。 */
const TRACKED_SELECTOR =
  'button, a, summary, [role="button"], [role="checkbox"], [role="option"], [role="tab"], [role="menuitem"]';
const FLUSH_DELAY_MS = 5000;
const NAME_MAX_LENGTH = 100;

let queue: UsageEventInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** 溜めた記録をまとめて送る。画面を閉じる間際でも届くよう sendBeacon を使う。 */
export function flushUsageEvents() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (queue.length === 0) return;
  const body = JSON.stringify({ events: queue });
  queue = [];
  // 文字列で送ると text/plain になるが、サーバーは Content-Type を見ずに JSON として読む
  navigator.sendBeacon('/api/usage-events', body);
}

export function trackUsage(kind: UsageEventInput['kind'], name: string) {
  queue.push({
    kind,
    name: name.slice(0, NAME_MAX_LENGTH),
    path: window.location.pathname,
  });
  flushTimer ??= setTimeout(flushUsageEvents, FLUSH_DELAY_MS);
}

/**
 * クリックされた要素から、記録する操作名を決める。
 * data-track > aria-label > 表示テキスト > アイコン名 の順に使う。操作対象でなければ null。
 */
export function usageNameOf(target: Element): string | null {
  const el = target.closest(TRACKED_SELECTOR);
  if (!el) return null;
  const tracked = el.closest<HTMLElement>('[data-track]')?.dataset.track;
  if (tracked) return tracked;
  const label =
    el.getAttribute('aria-label') ?? el.textContent.replace(/\s+/g, ' ').trim();
  if (label) return label;
  const icon = [...(el.querySelector('svg')?.classList ?? [])].find((name) =>
    name.startsWith('lucide-'),
  );
  return icon ? `icon:${icon.slice('lucide-'.length)}` : el.tagName;
}
