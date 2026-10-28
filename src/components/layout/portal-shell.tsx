"use client";

import {
  BarChart3,
  Bell,
  Blocks,
  BookOpenCheck,
  CalendarDays,
  FileBadge,
  FilePlus,
  Files,
  FileText,
  GraduationCap,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  PanelsTopLeft,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { ReactNode } from "react";
import { ROLE_LABELS } from "@/lib/constants";
import { navigationByRole } from "@/lib/navigation";
import { formatUnreadCount } from "@/lib/notifications";
import type { DashboardRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AppLogo } from "./app-logo";

const icons = {
  BarChart3,
  Bell,
  Blocks,
  BookOpenCheck,
  CalendarDays,
  FileBadge,
  FilePlus,
  Files,
  FileText,
  GraduationCap,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Library,
  Menu,
  PanelsTopLeft,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  UserRound,
  Users,
  X,
};

function roleFromPath(pathname: string): DashboardRole {
  if (pathname.startsWith("/admin")) {
    return "admin";
  }
  if (pathname.startsWith("/registrar")) {
    return "registrar";
  }
  return "student";
}

function HeaderSearchForm({ role, defaultValue = "" }: { role: DashboardRole; defaultValue?: string }) {
  return (
    <form
      role="search"
      method="get"
      action={`/${role}/search`}
      className="hidden min-w-0 flex-1 items-center rounded-md border border-border bg-slate-50 px-3 py-2 sm:flex"
    >
      <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search records, requests, students"
        aria-label="Search records, requests, students"
        className="ml-2 w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500"
      />
    </form>
  );
}

function HeaderSearch({ role }: { role: DashboardRole }) {
  const searchParams = useSearchParams();
  return <HeaderSearchForm role={role} defaultValue={searchParams.get("q") ?? ""} />;
}

function SidebarAccountActions({
  signingOut,
  onSignOut,
  onNavigate,
}: {
  signingOut: boolean;
  onSignOut: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-border px-3 py-4">
      <Link
        href="/change-password"
        prefetch={false}
        onClick={onNavigate}
        className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600 transition hover:bg-rose-50 hover:text-brand"
      >
        <KeyRound className="h-4 w-4" aria-hidden />
        <span className="truncate">Change password</span>
      </Link>
      <button
        type="button"
        onClick={onSignOut}
        disabled={signingOut}
        className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600 transition hover:bg-rose-50 hover:text-brand disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        <span className="truncate">{signingOut ? "Signing out..." : "Sign out"}</span>
      </button>
    </div>
  );
}

export function PortalShell({ children, unreadCount }: { children: ReactNode; unreadCount?: number }) {
  const pathname = usePathname();
  const role = roleFromPath(pathname);
  const nav = navigationByRole[role];
  const badgeLabel = formatUnreadCount(unreadCount ?? 0);
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/sign-in");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-border bg-white lg:flex">
        <div className="flex h-20 items-center border-b border-border px-5">
          <AppLogo />
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {nav.map((item) => {
            const Icon = icons[item.icon as keyof typeof icons] ?? LayoutDashboard;
            const active = pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                  active ? "bg-brand text-white" : "text-slate-600 hover:bg-rose-50 hover:text-brand",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="truncate">{item.label}</span>
                {item.badge && badgeLabel ? (
                  <span
                    aria-label={`${badgeLabel} unread`}
                    className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white ring-2 ring-white"
                  >
                    {badgeLabel}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <SidebarAccountActions signingOut={signingOut} onSignOut={signOut} />
      </aside>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-white transform transition-transform duration-200 ease-in-out lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Mobile navigation"
      >
        <div className="flex h-20 items-center justify-between border-b border-border px-5">
          <AppLogo />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-slate-600"
            onClick={closeMobileMenu}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {nav.map((item) => {
            const Icon = icons[item.icon as keyof typeof icons] ?? LayoutDashboard;
            const active = pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={closeMobileMenu}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                  active ? "bg-brand text-white" : "text-slate-600 hover:bg-rose-50 hover:text-brand",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="truncate">{item.label}</span>
                {item.badge && badgeLabel ? (
                  <span
                    aria-label={`${badgeLabel} unread`}
                    className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white ring-2 ring-white"
                  >
                    {badgeLabel}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <SidebarAccountActions
          signingOut={signingOut}
          onSignOut={() => {
            closeMobileMenu();
            void signOut();
          }}
          onNavigate={closeMobileMenu}
        />
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-slate-600 lg:hidden"
              aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
              onClick={toggleMobileMenu}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="lg:hidden">
              <AppLogo compact />
            </div>
            <Suspense fallback={<HeaderSearchForm role={role} />}>
              <HeaderSearch role={role} />
            </Suspense>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-brand ring-1 ring-rose-100 sm:inline-flex">
                {ROLE_LABELS[role]}
              </span>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

