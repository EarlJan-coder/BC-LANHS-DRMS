import { z } from "zod";
import { getDb } from "@/db";
import { systemSettings } from "@/db/schema";
import { recordAuditedAction } from "@/lib/services/audit-log";

const settingsShape = {
  signupOpen: z.boolean(),
  emailFromName: z
    .string()
    .trim()
    .min(1, "Enter the sender name for outgoing emails.")
    .max(100, "The sender name must be 100 characters or fewer."),
  emailFromAddress: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address for outgoing emails.")
    .max(191, "The sender email address must be 191 characters or fewer."),
  autoFixProofs: z.boolean(),
};

export const systemSettingsSchema = z.object(settingsShape);
export type SystemSettings = z.infer<typeof systemSettingsSchema>;
export type SystemSettingsKey = keyof SystemSettings;

export const SETTINGS_KEYS = Object.keys(settingsShape) as SystemSettingsKey[];

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  signupOpen: true,
  emailFromName: "LANHS DRMS",
  emailFromAddress: "no-reply@lanhsdrms.online",
  autoFixProofs: true,
};

export function parseSystemSettings(input: unknown): SystemSettings {
  return systemSettingsSchema.parse(input);
}

function isSettingsKey(key: string): key is SystemSettingsKey {
  return (SETTINGS_KEYS as string[]).includes(key);
}

/**
 * Parses a `RESEND_FROM_EMAIL`-style value ("Name <address>" or a bare
 * address). Used so deployments that configured the sender through the
 * environment keep working until an admin saves a sender.
 */
function parseFromEmail(raw: string): { name: string | null; address: string } | null {
  const match = raw.match(/^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  if (match) return { name: match[1] || null, address: match[2] };
  const address = raw.trim();
  return address.includes("@") ? { name: null, address } : null;
}

/**
 * Reads the stored settings, falling back to the defaults per key. A corrupt
 * row is ignored instead of breaking the page that asked for settings.
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  const db = getDb();
  const rows = await db.select().from(systemSettings);
  const envSender = process.env.RESEND_FROM_EMAIL ? parseFromEmail(process.env.RESEND_FROM_EMAIL) : null;
  const merged: SystemSettings = {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...(envSender
      ? {
          emailFromName: envSender.name ?? DEFAULT_SYSTEM_SETTINGS.emailFromName,
          emailFromAddress: envSender.address,
        }
      : {}),
  };

  for (const row of rows) {
    if (!isSettingsKey(row.key)) continue;
    const parsed = settingsShape[row.key].safeParse(row.value);
    if (parsed.success) merged[row.key] = parsed.data as never;
  }

  return merged;
}

export async function saveSystemSettings(input: unknown, actorUserId?: string): Promise<SystemSettings> {
  const values = parseSystemSettings(input);
  const previous = await getSystemSettings();
  const changed = SETTINGS_KEYS.filter((key) => values[key] !== previous[key]);

  const db = getDb();
  const now = new Date();
  for (const key of changed) {
    await db
      .insert(systemSettings)
      .values({ key, value: values[key], updatedAt: now, updatedBy: actorUserId ?? null })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: values[key], updatedAt: now, updatedBy: actorUserId ?? null },
      });
  }

  if (changed.length > 0) {
    await recordAuditedAction({
      referenceId: "system_settings",
      action: "update_settings",
      actorRole: "admin",
      entityType: "system_settings",
      entityId: "system_settings",
      actorUserId,
      description: `Updated system settings: ${changed.join(", ")}`,
      metadata: { changed },
    });
  }

  return values;
}
