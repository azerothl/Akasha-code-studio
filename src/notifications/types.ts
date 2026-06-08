export type NotificationLevel = "error" | "warning" | "success" | "info";

export type Notification = {
  id: string;
  level: NotificationLevel;
  title: string;
  detail?: string;
  source?: string;
  timestamp: number;
  read: boolean;
};

export type NotifyInput = {
  level: NotificationLevel;
  title: string;
  detail?: string;
  source?: string;
};
