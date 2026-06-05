import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Notification, NotifyInput } from "./types";

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  notify: (input: NotifyInput) => string;
  dismiss: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const seenRef = useRef(new Set<string>());

  const notify = useCallback((input: NotifyInput): string => {
    const dedupeKey = `${input.level}:${input.title}:${input.detail ?? ""}:${input.source ?? ""}`;
    if (seenRef.current.has(dedupeKey)) {
      const existing = notifications.find(
        (n) =>
          n.level === input.level &&
          n.title === input.title &&
          n.detail === input.detail &&
          n.source === input.source,
      );
      return existing?.id ?? "";
    }
    seenRef.current.add(dedupeKey);
    window.setTimeout(() => seenRef.current.delete(dedupeKey), 3000);

    const id = makeId();
    const item: Notification = {
      id,
      level: input.level,
      title: input.title,
      detail: input.detail,
      source: input.source,
      timestamp: Date.now(),
      read: false,
    };
    setNotifications((prev) => [item, ...prev].slice(0, 100));
    return id;
  }, [notifications]);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      notify,
      dismiss,
      markRead,
      markAllRead,
      clearAll,
    }),
    [notifications, unreadCount, notify, dismiss, markRead, markAllRead, clearAll],
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}

/** Safe hook for optional notification usage outside provider (returns no-op). */
export function useNotifyOptional(): Pick<NotificationContextValue, "notify"> {
  const ctx = useContext(NotificationContext);
  return {
    notify: ctx?.notify ?? (() => ""),
  };
}
