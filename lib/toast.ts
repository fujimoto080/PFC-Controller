import type { ReactNode } from 'react';
import {
  toast as sonnerToast,
  type ExternalToast,
  type ToastT,
} from 'sonner';

const 最大表示数 = 3;
const 表示中トーストID一覧: string[] = [];
let 連番 = 0;

const IDを文字列化 = (id: string | number) => String(id);

const トーストIDを削除 = (id: string | number) => {
  const 文字列ID = IDを文字列化(id);
  const index = 表示中トーストID一覧.indexOf(文字列ID);
  if (index >= 0) {
    表示中トーストID一覧.splice(index, 1);
  }
};

const 最大表示数に調整 = () => {
  while (表示中トーストID一覧.length > 最大表示数) {
    const 最古ID = 表示中トーストID一覧.shift();
    if (最古ID) {
      sonnerToast.dismiss(最古ID);
    }
  }
};

const オプションを拡張 = (
  id: string,
  options?: ExternalToast
): ExternalToast => ({
  ...options,
  id,
  onDismiss: (toast: ToastT) => {
    トーストIDを削除(toast.id);
    options?.onDismiss?.(toast);
  },
  onAutoClose: (toast: ToastT) => {
    トーストIDを削除(toast.id);
    options?.onAutoClose?.(toast);
  },
});

const トーストを登録 = (id: string | number) => {
  表示中トーストID一覧.push(IDを文字列化(id));
  最大表示数に調整();
};

const 新しいIDを生成 = () => {
  連番 += 1;
  return `pfc-toast-${Date.now()}-${連番}`;
};

const 通知を表示 = (
  実行: (message: string | ReactNode, data?: ExternalToast) => string | number,
  message: string | ReactNode,
  options?: ExternalToast
) => {
  const id = options?.id ? IDを文字列化(options.id) : 新しいIDを生成();
  const toastId = 実行(message, オプションを拡張(id, options));
  トーストを登録(toastId);
  return toastId;
};

type ToastMessage = string | ReactNode;

interface Toast関数 {
  (message: ToastMessage, options?: ExternalToast): string | number;
  success: (message: ToastMessage, options?: ExternalToast) => string | number;
  info: (message: ToastMessage, options?: ExternalToast) => string | number;
  warning: (message: ToastMessage, options?: ExternalToast) => string | number;
  error: (message: ToastMessage, options?: ExternalToast) => string | number;
  loading: (message: ToastMessage, options?: ExternalToast) => string | number;
  dismiss: (toastId?: string | number) => void;
}

export const toast: Toast関数 = Object.assign(
  (message: ToastMessage, options?: ExternalToast) =>
    通知を表示(sonnerToast, message, options),
  {
    success: (message: ToastMessage, options?: ExternalToast) =>
      通知を表示(sonnerToast.success, message, options),
    info: (message: ToastMessage, options?: ExternalToast) =>
      通知を表示(sonnerToast.info, message, options),
    warning: (message: ToastMessage, options?: ExternalToast) =>
      通知を表示(sonnerToast.warning, message, options),
    error: (message: ToastMessage, options?: ExternalToast) =>
      通知を表示(sonnerToast.error, message, options),
    loading: (message: ToastMessage, options?: ExternalToast) =>
      通知を表示(sonnerToast.loading, message, options),
    dismiss: (toastId?: string | number) => {
      if (toastId === undefined) {
        表示中トーストID一覧.splice(0, 表示中トーストID一覧.length);
      } else {
        トーストIDを削除(toastId);
      }
      sonnerToast.dismiss(toastId);
    },
  }
);
