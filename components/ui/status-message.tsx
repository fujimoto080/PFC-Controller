/** 読み込み中・空・失敗などの状態を一覧の代わりに示す文言。 */
export function StatusMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground py-6 text-center text-sm">{children}</p>
  );
}
