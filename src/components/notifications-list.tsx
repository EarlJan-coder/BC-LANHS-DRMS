"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { NotificationDetailModal, type NotificationDetail } from "@/components/notification-detail-modal";
import type { UserRole } from "@/db/schema";
import { formatDateTime } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationsList({
  initialNotifications,
  viewerRole,
}: {
  initialNotifications: NotificationItem[];
  viewerRole: UserRole;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [busy, setBusy] = useState<string | "all" | null>(null);
  const [detail, setDetail] = useState<NotificationDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hasUnread = notifications.some((notification) => !notification.isRead);

  async function openNotification(target: NotificationItem) {
    if (busy) return;
    setBusy(target.id);
    try {
      const detailsResponse = await fetch(`/api/notifications/${target.id}/details`);
      const detailsResult = await detailsResponse.json();
      if (!detailsResponse.ok) {
        toast.error(detailsResult.error ?? "Unable to load notification details.");
        return;
      }
      setSelectedId(target.id);
      setDetail(detailsResult.data as NotificationDetail);

      if (!target.isRead) {
        const response = await fetch(`/api/notifications/${target.id}`, { method: "PATCH" });
        if (!response.ok) {
          toast.error("Notification details opened, but it could not be marked as read.");
          return;
        }
        setNotifications((current) => current.map((item) => item.id === target.id ? { ...item, isRead: true } : item));
        router.refresh();
      }
    } catch {
      toast.error("Unable to open notification. Check your connection and try again.");
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
              onClick={() => openNotification(notification)}
              disabled={busy !== null}
              aria-label={`Open notification: ${notification.title}`}
              className={`flex w-full items-start gap-3 rounded-lg border border-border bg-white p-4 text-left transition hover:bg-rose-50 disabled:cursor-default disabled:hover:bg-white ${
                notification.isRead ? "opacity-70" : ""
              }`}
            >
              {busy === notification.id ? (
                <Spinner className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              ) : (
                <Bell className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
              )}
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
      <NotificationDetailModal
        key={selectedId ?? "none"}
        detail={detail}
        viewerRole={viewerRole}
        onClose={() => {
          setDetail(null);
          setSelectedId(null);
        }}
        onDecisionComplete={() => {
          setDetail(null);
          setSelectedId(null);
          router.refresh();
        }}
      />
    </div>
  );
}
