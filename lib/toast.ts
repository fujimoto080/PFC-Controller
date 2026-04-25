import type { ReactNode } from 'react';
import {
  toast as sonnerToast,
  type ExternalToast,
  type ToastT,
} from 'sonner';

type ToastMessage = string | ReactNode;
type SonnerImpl = (message: ToastMessage, data?: ExternalToast) => string | number;

const MAX_VISIBLE = 3;
const visibleIds: string[] = [];
let sequence = 0;

const toKey = (id: string | number) => String(id);

const unregister = (id: string | number) => {
  const index = visibleIds.indexOf(toKey(id));
  if (index >= 0) visibleIds.splice(index, 1);
};

const register = (id: string | number) => {
  visibleIds.push(toKey(id));
  while (visibleIds.length > MAX_VISIBLE) {
    const oldest = visibleIds.shift();
    if (oldest) sonnerToast.dismiss(oldest);
  }
};

const nextId = () => {
  sequence += 1;
  return `pfc-toast-${Date.now()}-${sequence}`;
};

const show = (
  impl: SonnerImpl,
  message: ToastMessage,
  options?: ExternalToast,
) => {
  const id = options?.id ? toKey(options.id) : nextId();
  const toastId = impl(message, {
    ...options,
    id,
    onDismiss: (t: ToastT) => {
      unregister(t.id);
      options?.onDismiss?.(t);
    },
    onAutoClose: (t: ToastT) => {
      unregister(t.id);
      options?.onAutoClose?.(t);
    },
  });
  register(toastId);
  return toastId;
};

interface ToastApi {
  (message: ToastMessage, options?: ExternalToast): string | number;
  success: SonnerImpl;
  info: SonnerImpl;
  warning: SonnerImpl;
  error: SonnerImpl;
  loading: SonnerImpl;
  dismiss: (toastId?: string | number) => void;
  // エラーから安全にメッセージを取り出して console.error + toast.error する。
  // userFallback を省略すると logLabel が UI にも使われる。
  fromError: (
    logLabel: string,
    error: unknown,
    userFallback?: string,
    options?: ExternalToast,
  ) => string | number;
}

export const toast: ToastApi = Object.assign(
  (message: ToastMessage, options?: ExternalToast) =>
    show(sonnerToast, message, options),
  {
    success: (message: ToastMessage, options?: ExternalToast) =>
      show(sonnerToast.success, message, options),
    info: (message: ToastMessage, options?: ExternalToast) =>
      show(sonnerToast.info, message, options),
    warning: (message: ToastMessage, options?: ExternalToast) =>
      show(sonnerToast.warning, message, options),
    error: (message: ToastMessage, options?: ExternalToast) =>
      show(sonnerToast.error, message, options),
    loading: (message: ToastMessage, options?: ExternalToast) =>
      show(sonnerToast.loading, message, options),
    dismiss: (toastId?: string | number) => {
      if (toastId === undefined) {
        visibleIds.length = 0;
      } else {
        unregister(toastId);
      }
      sonnerToast.dismiss(toastId);
    },
    fromError: (
      logLabel: string,
      error: unknown,
      userFallback?: string,
      options?: ExternalToast,
    ) => {
      console.error(logLabel, error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : (userFallback ?? logLabel);
      return show(sonnerToast.error, message, options);
    },
  },
);
