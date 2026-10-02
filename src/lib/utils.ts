import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { REQUEST_STATUSES } from "./constants";
import type { RequestStatus } from "@/db/schema";

export const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function statusLabel(status: RequestStatus) {
  return REQUEST_STATUSES.find((item) => item.value === status)?.label ?? status;
}

export function statusTone(status: RequestStatus) {
  return REQUEST_STATUSES.find((item) => item.value === status)?.tone ?? "bg-slate-100 text-slate-700 ring-slate-200";
}

export function formatDate(date: Date | null | undefined, fallback = "Not set") {
  return date ? date.toISOString().slice(0, 10) : fallback;
}

export function formatDateTime(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 16).replace("T", " ") : "Not set";
}

export function generateTrackingNumber(prefix = "LANHS") {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${date}-${random}`;
}

export function generatePrefixedId(prefix: string) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${date}-${random}`;
}

export function studentFullName(row: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
}) {
  return [row.firstName, row.middleName, row.lastName, row.suffix].filter(Boolean).join(" ");
}

export class AppError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

