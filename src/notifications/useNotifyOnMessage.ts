import { useEffect, useRef } from "react";
import { useNotifications } from "./NotificationContext";
import type { NotificationLevel, NotifyInput } from "./types";

/** Push to notification center when error/warning string becomes non-empty. */
export function useNotifyOnMessage(
  message: string | null | undefined,
  level: NotificationLevel,
  source: string,
  title?: string,
) {
  const { notify } = useNotifications();
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    const msg = message?.trim() ?? "";
    if (!msg) {
      prevRef.current = null;
      return;
    }
    if (msg === prevRef.current) return;
    prevRef.current = msg;
    notify({ level, title: title ?? msg, detail: title ? msg : undefined, source });
  }, [message, level, source, title, notify]);
}

export function useNotify() {
  return useNotifications().notify;
}

export type { NotifyInput };
