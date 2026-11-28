"use client";

import {
  BarChart3,
  Bell,
  Blocks,
  BookOpenCheck,
  CalendarDays,
  FileBadge,
  FilePlus,
  FileSignature,
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
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChangePasswordForm } from "@/components/change-password-form";
import { PendingForm } from "@/components/ui/pending-form";
import { LinkPendingContent } from "@/components/ui/pending-link";
import { Spinner } from "@/components/ui/spinner";
import { ROLE_LABELS } from "@/lib/constants";
import { isNavItemActive, navigationByRole } from "@/lib/navigation";
import type { DashboardRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AppLogo } from "./app-logo";
import { NotificationBell } from "@/components/notification-bell";
import type { UserRole } from "@/db/schema";

const icons = {
  BarChart3,
  Bell,
  Blocks,
  BookOpenCheck,
  CalendarDays,
  FileBadge,
  FilePlus,
  FileSignature,
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
  UserRoundCheck,
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
    <PendingForm
      role="search"
      action={`/${role}/search`}
      className="flex min-w-0 flex-1 items-center rounded-lg px-0 py-0"
    >
      {({ isPending }) => (
        <>
          {isPending ? <Spinner className="shrink-0 text-slate-400" /> : null}
          <input
            key={defaultValue}
            type="search"
            name="q"
            defaultValue={defaultValue}
            autoFocus
            placeholder="Search records, requests, students"
            aria-label="Search records, requests, students"
            className={cn("w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500", isPending && "ml-2")}
          />
        </>
      )}
    </PendingForm>
  );
}

function HeaderSearch({ role }: { role: DashboardRole }) {
  const searchParams = useSearchParams();
  return <HeaderSearchForm role={role} defaultValue={searchParams.get("q") ?? ""} />;
}

function SidebarAccountActions({
  signingOut,
  onSignOut,
  onChangePassword,
}: {
  signingOut: boolean;
  onSignOut: () => void;
  onChangePassword: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-slate-100 px-3 py-4">
      <button
        type="button"
        onClick={onChangePassword}
        className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-rose-50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <KeyRound className="h-4 w-4" aria-hidden />
        <span className="truncate">Change password</span>
      </button>
      <button
        type="button"
        onClick={onSignOut}
        disabled={signingOut}
        aria-busy={signingOut || undefined}
        className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-rose-50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
      >
        {signingOut ? <Spinner className="h-4 w-4" /> : <LogOut className="h-4 w-4" aria-hidden />}
        <span className="truncate">{signingOut ? "Signing out..." : "Sign out"}</span>
      </button>
    </div>
  );
}

export function PortalShell({
  children,
  unreadCount,
  viewerRole,
  studentType,
}: {
  children: ReactNode;
  unreadCount?: number;
  viewerRole?: UserRole;
  studentType?: "current" | "alumni" | "transferee";
}) {
  const pathname = usePathname();
  const role = roleFromPath(pathname);
  const nav = navigationByRole[role];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const changePasswordRef = useRef<HTMLElement>(null);
  const globalSearchRef = useRef<HTMLDivElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);

  // While the change-password modal is open: Escape closes it and focus moves
  // to its first field (matching ConfirmDialog's keyboard behavior).
  useEffect(() => {
    if (!changePasswordOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setChangePasswordOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => {
      changePasswordRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    }, 0);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [changePasswordOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const focusTimer = window.setTimeout(() => {
      globalSearchRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus({ preventScroll: true });
    }, 120);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSearchOpen(false);
        searchToggleRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [searchOpen]);

  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Hard navigation: purges every client cache with the signed-out state.
      window.location.replace("/sign-in");
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* ── Desktop sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200/80 bg-white lg:flex">
        <div className="flex h-[76px] items-center border-b border-slate-100 px-5">
          <AppLogo />
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5">
          {nav.map((item, index) => {
            const Icon = icons[item.icon as keyof typeof icons] ?? LayoutDashboard;
            const active = isNavItemActive(pathname, item.href, nav);
            const showSection = item.section && item.section !== nav[index - 1]?.section;

            return (
              <Fragment key={item.href}>
                {showSection ? (
                  <p className={cn("px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400", index > 0 && "pt-5")}>
                    {item.section}
                  </p>
                ) : null}
                <Link
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    "relative flex h-10 items-center gap-3 rounded-md border-l-2 px-3 text-[13px] font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    active ? "border-brand bg-rose-50/70 text-brand" : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                  )}
                >
                  <LinkPendingContent icon={<Icon className="h-4 w-4" aria-hidden />} className="gap-3">
                    <span className="truncate">{item.label}</span>
                  </LinkPendingContent>
                </Link>
              </Fragment>
            );
          })}
        </nav>
        <SidebarAccountActions
          signingOut={signingOut}
          onSignOut={signOut}
          onChangePassword={() => setChangePasswordOpen(true)}
        />
      </aside>

      {/* ── Mobile menu overlay ── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white shadow-2xl shadow-slate-950/10 transform transition-transform duration-200 ease-in-out lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Mobile navigation"
      >
        <div className="flex h-[76px] items-center justify-between border-b border-slate-100 px-5">
          <AppLogo />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            onClick={closeMobileMenu}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5">
          {nav.map((item, index) => {
            const Icon = icons[item.icon as keyof typeof icons] ?? LayoutDashboard;
            const active = isNavItemActive(pathname, item.href, nav);
            const showSection = item.section && item.section !== nav[index - 1]?.section;

            return (
              <Fragment key={item.href}>
                {showSection ? (
                  <p className={cn("px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400", index > 0 && "pt-5")}>
                    {item.section}
                  </p>
                ) : null}
                <Link
                  href={item.href}
                  prefetch={false}
                  onClick={closeMobileMenu}
                  className={cn(
                    "relative flex h-10 items-center gap-3 rounded-md border-l-2 px-3 text-[13px] font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    active ? "border-brand bg-rose-50/70 text-brand" : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                  )}
                >
                  <LinkPendingContent icon={<Icon className="h-4 w-4" aria-hidden />} className="gap-3">
                    <span className="truncate">{item.label}</span>
                  </LinkPendingContent>
                </Link>
              </Fragment>
            );
          })}
        </nav>
        <SidebarAccountActions
          signingOut={signingOut}
          onSignOut={() => {
            closeMobileMenu();
            void signOut();
          }}
          onChangePassword={() => {
            closeMobileMenu();
            setChangePasswordOpen(true);
          }}
        />
      </aside>

      {/* ── Change password modal (portals) ── */}
      {changePasswordOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setChangePasswordOpen(false);
          }}
        >
          <section
            ref={changePasswordRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 id="change-password-title" className="text-lg font-semibold text-slate-950">
                  Change password
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  You will be signed out after changing your password.
                </p>
              </div>
              <Button
                type="button"
                tone="secondary"
                size="sm"
                onClick={() => setChangePasswordOpen(false)}
              >
                Close
              </Button>
            </header>
            <div className="p-5">
              <ChangePasswordForm mustChangePassword={false} />
            </div>
          </section>
        </div>
      ) : null}

      {/* ── Main content area ── */}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
          {/* Top row: mobile toggle · logo · role label · notification bell */}
          <div className="mx-auto flex h-16 max-w-[1680px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 lg:hidden"
              aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
              onClick={toggleMobileMenu}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="lg:hidden">
              <AppLogo compact />
            </div>

            <div
              className={cn(
                "flex h-10 min-w-0 shrink-0 items-center overflow-hidden transition-[width] duration-300 ease-out motion-reduce:transition-none",
                searchOpen
                  ? "w-[calc(100vw-12rem)] rounded-lg border border-slate-200 bg-white px-1 sm:w-[calc(100vw-18rem)] md:w-[calc(100vw-20rem)] lg:w-[min(26rem,calc(100vw-40rem))]"
                  : "w-10",
              )}
            >
              <button
                ref={searchToggleRef}
                type="button"
                aria-label={searchOpen ? "Close search" : "Search"}
                aria-expanded={searchOpen}
                aria-controls="portal-global-search"
                onClick={() => setSearchOpen((open) => !open)}
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
                  !searchOpen && "h-10 w-10 rounded-lg border border-slate-200 bg-white",
                )}
              >
                <Search className="h-5 w-5" aria-hidden />
              </button>
              <div
                ref={globalSearchRef}
                id="portal-global-search"
                aria-hidden={!searchOpen}
                inert={!searchOpen}
                className={cn(
                  "min-w-0 overflow-hidden transition-[flex,opacity] duration-300 ease-out motion-reduce:transition-none",
                  searchOpen ? "ml-2 flex-1 opacity-100" : "w-0 flex-none opacity-0",
                )}
              >
                <Suspense fallback={<HeaderSearchForm role={role} />}>
                  <HeaderSearch role={role} />
                </Suspense>
              </div>
            </div>

            {/* Right cluster: role pill + bell */}
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-xs font-medium text-slate-500 sm:inline-flex">
                {role === "student" && studentType === "alumni" ? "Alumni" : ROLE_LABELS[role]}
              </span>
              <NotificationBell
                initialUnreadCount={unreadCount ?? 0}
                viewerRole={viewerRole ?? role}
                dashboardRole={role}
              />
            </div>
          </div>

        </header>

        <main className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
