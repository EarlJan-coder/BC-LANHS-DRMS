"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationsList({ initialNotifications }: { initialNotifications: NotificationItem[] }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [busy, setBusy] = useState<string | "all" | null>(null);
  const hasUnread = notifications.some((notification) => !notification.isRead);

  async function markOneRead(id: string) {
    const target = notifications.find((notification) => notification.id === id);
    if (!target || target.isRead) {
      return;
    }

    setBusy(id);
    try {
      const response = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      if (!response.ok) {
        toast.error("Unable to update notification.");
        return;
      }
      setNotifications((current) =>
        current.map((notification) => (notification.id === id ? { ...notification, isRead: true } : notification)),
      );
      // Badge lives in the server layout — refresh it.
      router.refresh();
    } catch {
      toast.error("Unable to update notification. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function markAllRead() {
    setBusy("all");
    try {
      const response = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!response.ok) {
        toast.error("Unable to update notifications.");
        return;
      }
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
      router.refresh();
    } catch {
      toast.error("Unable to update notifications. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button type="button" tone="secondary" onClick={markAllRead} loading={busy === "all"} disabled={busy !== null || !hasUnread}>
          <CheckCheck className="h-4 w-4" aria-hidden />
          Mark all as read
        </Button>
      </div>

      <div className="grid gap-3">
        {notifications.length === 0 ? (
          <Card className="p-4 text-sm text-slate-500">No notifications yet.</Card>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => markOneRead(notification.id)}
              disabled={busy !== null || notification.isRead}
              aria-label={`Mark "${notification.title}" as read`}
              className={`flex w-full items-start gap-3 rounded-lg border border-border bg-white p-4 text-left transition hover:bg-rose-50 disabled:cursor-default disabled:hover:bg-white ${
                notification.isRead ? "opacity-70" : ""
              }`}
            >
              <Bell className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {!notification.isRead ? (
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-600 align-middle" aria-label="Unread" />
                  ) : null}
                  {notification.title}
                </p>
                <p className="mt-1 text-sm text-slate-700">{notification.message}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(new Date(notification.createdAt))}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
