import { toast as sonnerToast } from 'sonner';

/** エラーをログに残し、Error のメッセージ（無ければ fallback）をトーストで表示する。 */
function fromError(logLabel: string, error: unknown, fallback = logLabel) {
  console.error(logLabel, error);
  const message =
    error instanceof Error && error.message ? error.message : fallback;
  return sonnerToast.error(message);
}

/** 処理中はローディングトーストを表示し、完了（成功・失敗問わず）で消す。 */
async function withLoading<T>(message: string, fn: () => Promise<T>) {
  const id = sonnerToast.loading(message);
  try {
    return await fn();
  } finally {
    sonnerToast.dismiss(id);
  }
}

export const toast = {
  success: sonnerToast.success,
  info: sonnerToast.info,
  error: sonnerToast.error,
  fromError,
  withLoading,
};
