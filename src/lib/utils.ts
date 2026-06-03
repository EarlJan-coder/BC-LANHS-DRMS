import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { REQUEST_STATUSES } from "./constants";
import type { RequestStatus } from "@/db/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function statusLabel(status: RequestStatus) {
  return REQUEST_STATUSES.find((item) => item.value === status)?.label ?? status;
}

export function statusTone(status: RequestStatus) {
  return REQUEST_STATUSES.find((item) => item.value === status)?.tone ?? "bg-slate-100 text-slate-700 ring-slate-200";
}

export function generateTrackingNumber(prefix = "LANHS") {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${date}-${random}`;
}

export function peso(value: string | number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value));
}

