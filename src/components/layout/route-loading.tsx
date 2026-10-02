import Image from "next/image";
import { APP_NAME, SCHOOL_NAME } from "@/lib/constants";

export function RouteLoading({ status = "Loading" }: { status?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 py-10"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Image
          src="/lanhs-logo.png"
          alt=""
          width={96}
          height={96}
          priority
          className="h-24 w-24"
        />
        <div>
          <p className="text-lg font-bold text-slate-950">{APP_NAME}</p>
          <p className="mt-1 max-w-xs text-sm leading-5 text-slate-500 sm:max-w-none">
            {SCHOOL_NAME}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent"
        />
        <span>{status}…</span>
      </div>
    </div>
  );
}
