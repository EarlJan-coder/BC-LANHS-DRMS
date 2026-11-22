"use client";

import { Check, X } from "lucide-react";
import { PASSWORD_REQUIREMENTS, passwordRequirements } from "@/lib/password-policy";
import { cn } from "@/lib/utils";

/**
 * Live checklist for the strong password policy. Shows every requirement from
 * `PASSWORD_REQUIREMENTS` and ticks it off as the typed password satisfies it,
 * so the forms and the server validation always tell the same story.
 */
export function PasswordPolicyChecklist({ password }: { password: string }) {
  const met = passwordRequirements(password);

  return (
    <ul aria-label="Password requirements" className="grid gap-1 text-xs">
      {PASSWORD_REQUIREMENTS.map((requirement) => (
        <li
          key={requirement.key}
          className={cn(
            "flex items-center gap-1.5",
            met[requirement.key] ? "text-emerald-700" : "text-slate-500",
          )}
        >
          {met[requirement.key] ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <X className="h-3.5 w-3.5" aria-hidden />
          )}
          {requirement.label}
        </li>
      ))}
    </ul>
  );
}
