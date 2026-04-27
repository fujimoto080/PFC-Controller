import type { ReactNode } from 'react';
import { toast as sonnerToast, type ExternalToast } from 'sonner';

type ToastMessage = string | ReactNode;
type SonnerImpl = (message: ToastMessage, data?: ExternalToast) => string | number;

interface ToastApi {
  (message: ToastMessage, options?: ExternalToast): string | number;
  success: SonnerImpl;
  info: SonnerImpl;
  warning: SonnerImpl;
  error: SonnerImpl;
  loading: SonnerImpl;
  dismiss: (toastId?: string | number) => void;
  fromError: (
    logLabel: string,
    error: unknown,
    userFallback?: string,
    options?: ExternalToast,
  ) => string | number;
}

export const toast: ToastApi = Object.assign(
  (message: ToastMessage, options?: ExternalToast) => sonnerToast(message, options),
  {
    success: sonnerToast.success,
    info: sonnerToast.info,
    warning: sonnerToast.warning,
    error: sonnerToast.error,
    loading: sonnerToast.loading,
    dismiss: sonnerToast.dismiss,
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
      return sonnerToast.error(message, options);
    },
  },
);
