"use client";

import { Bell, CheckCheck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { NotificationDetailModal, type NotificationDetail } from "@/components/notification-detail-modal";
import type { DashboardRole } from "@/lib/types";
import type { UserRole } from "@/db/schema";
import { cn, formatDateTime } from "@/lib/utils";
import { formatUnreadCount } from "@/lib/notifications";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

/** Derive the role-based redirect path for a notification detail record. */
function getRedirectPath(role: DashboardRole, detail: NotificationDetail): string | null {
  if (detail.kind === "request") {
    const id = detail.record.id as string | undefined;
    if (!id) return null;
    if (role === "registrar") return `/registrar/requests/${id}`;
    if (role === "student") return `/student/requests`;
    return null;
  }
  if (detail.kind === "registration") {
    if (role === "admin") return `/admin/registrations`;
    if (role === "registrar") return `/registrar/registrations`;
    if (role === "student") return `/student/profile`;
    return null;
  }
  if (detail.kind === "certificate") {
    const id = detail.record.id as string | undefined;
    if (!id) return null;
    if (role === "registrar") return `/registrar/certificates/${id}`;
    return null;
  }
  return null;
}

export function NotificationBell({
  initialUnreadCount = 0,
  viewerRole,
  dashboardRole,
}: {
  initialUnreadCount?: number;
  viewerRole: UserRole;
  dashboardRole: DashboardRole;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [busy, setBusy] = useState<string | "all" | null>(null);
  const [detail, setDetail] = useState<NotificationDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const badgeLabel = formatUnreadCount(unreadCount);

  // Real-time polling every 10 s
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/notifications/live", { cache: "no-store" });
        if (!res.ok) return;
        const result = await res.json() as { notifications: NotificationItem[]; unreadCount: number };
        if (!active) return;
        setUnreadCount(result.unreadCount);
        setNotifications((current) => {
          const byId = new Map(current.map((item) => [item.id, item]));
          for (const item of result.notifications) byId.set(item.id, item);
          return [...byId.values()]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 20);
        });
      } catch {
        // Silently retry on next poll
      }
    };

    // Refresh immediately on mount so the panel is populated right away,
    // then keep it fresh every 10 s and on window focus.
    void refresh();
    const interval = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // Close panel when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function openNotification(item: NotificationItem) {
    if (busy) return;
    setBusy(item.id);
    try {
      const detailsRes = await fetch(`/api/notifications/${item.id}/details`);
      const detailsResult = await detailsRes.json();
      if (!detailsRes.ok) {
        toast.error(detailsResult.error ?? "Unable to load notification details.");
        return;
      }
      const notifDetail = detailsResult.data as NotificationDetail;

      // Mark as read first (if unread)
      if (!item.isRead) {
        const patchRes = await fetch(`/api/notifications/${item.id}`, { method: "PATCH" });
        if (patchRes.ok) {
          setNotifications((current) =>
            current.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
          );
          setUnreadCount((c) => Math.max(0, c - 1));
          router.refresh();
        }
      }

      // Determine redirect target
      const redirectPath = getRedirectPath(dashboardRole, notifDetail);
      if (redirectPath) {
        setOpen(false);
        router.push(redirectPath);
      } else {
        // Fall back to showing the detail modal
        setSelectedId(item.id);
        setDetail(notifDetail);
        setOpen(false);
      }
    } catch {
      toast.error("Unable to open notification. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function markAllRead() {
    if (busy) return;
    setBusy("all");
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!res.ok) {
        toast.error("Unable to update notifications.");
        return;
      }
      setNotifications((current) => current.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      router.refresh();
    } catch {
      toast.error("Unable to update notifications. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {/* Bell trigger */}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={`Notifications${badgeLabel ? ` (${badgeLabel} unread)` : ""}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-rose-50 hover:text-brand"
        >
          <Bell className="h-5 w-5" aria-hidden />
          {badgeLabel && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-red-600 px-1 py-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-white"
            >
              {badgeLabel}
            </span>
          )}
        </button>

        {/* Dropdown panel — anchored to the bell */}
        {open && (
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 top-full z-50 mt-2 w-80 origin-top-right overflow-hidden rounded-xl border border-border bg-white shadow-xl ring-1 ring-black/5 sm:w-96"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  >
                    {busy === "all" ? (
                      <Spinner className="h-3 w-3" />
                    ) : (
                      <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close notifications"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <ul className="max-h-[min(28rem,80vh)] divide-y divide-border overflow-y-auto">
              {notifications.length === 0 ? (
                <li className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <Bell className="h-8 w-8 text-slate-200" aria-hidden />
                  <p className="text-sm text-slate-500">No notifications yet.</p>
                </li>
              ) : (
                notifications.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(item)}
                      disabled={busy !== null}
                      aria-label={`Open: ${item.title}`}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-rose-50 disabled:cursor-default disabled:hover:bg-white",
                        item.isRead ? "opacity-60" : "",
                      )}
                    >
                      {busy === item.id ? (
                        <Spinner className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      ) : (
                        <div className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", item.isRead ? "bg-transparent" : "bg-red-500")} aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.message}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{formatDateTime(new Date(item.createdAt))}</p>
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>

            {/* Footer link to the full notifications page */}
            <Link
              href={`/${dashboardRole}/notifications`}
              onClick={() => setOpen(false)}
              className="block border-t border-border px-4 py-2.5 text-center text-xs font-medium text-brand transition hover:bg-rose-50"
            >
              View all notifications
            </Link>
          </div>
        )}
      </div>

      {/* Detail modal (fallback when no redirect target) */}
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
    </>
  );
}

