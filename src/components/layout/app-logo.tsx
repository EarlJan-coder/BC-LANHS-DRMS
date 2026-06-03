import Image from "next/image";
import { APP_NAME, SCHOOL_NAME } from "@/lib/constants";

export function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Image src="/lanhs-logo.svg" alt="Luis Aguado National High School logo" width={44} height={44} priority />
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-950">{APP_NAME}</p>
          <p className="truncate text-xs text-slate-500">{SCHOOL_NAME}</p>
        </div>
      )}
    </div>
  );
}

