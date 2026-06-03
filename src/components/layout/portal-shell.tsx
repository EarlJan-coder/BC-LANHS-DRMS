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
  Menu,
  PanelsTopLeft,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { ROLE_LABELS } from "@/lib/constants";
import { navigationByRole } from "@/lib/navigation";
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
  PanelsTopLeft,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  UserRound,
  Users,
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

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const role = roleFromPath(pathname);
  const nav = navigationByRole[role];
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border bg-white lg:block">
        <div className="flex h-20 items-center border-b border-border px-5">
          <AppLogo />
        </div>
        <nav className="flex flex-col gap-1 px-3 py-4">
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
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-slate-600 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden">
              <AppLogo compact />
            </div>
            <div className="hidden min-w-0 flex-1 items-center rounded-md border border-border bg-slate-50 px-3 py-2 sm:flex">
              <Search className="h-4 w-4 text-slate-400" aria-hidden />
              <span className="ml-2 text-sm text-slate-500">Search records, requests, students</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-brand ring-1 ring-rose-100 sm:inline-flex">
                {ROLE_LABELS[role]}
              </span>
              {hasClerk ? (
                <>
                  <Show when="signed-in">
                    <UserButton />
                  </Show>
                  <Show when="signed-out">
                    <SignInButton mode="modal">
                      <button className="rounded-md border border-border px-3 py-2 text-sm font-medium text-slate-700">
                        Sign in
                      </button>
                    </SignInButton>
                  </Show>
                </>
              ) : (
                <span className="rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">Demo mode</span>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

