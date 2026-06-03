import { createHash } from "crypto";

export type AuditHashPayload = {
  referenceId: string;
  action: string;
  actorRole: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function createRecordHash(payload: AuditHashPayload) {
  return `0x${createHash("sha256").update(stableJson(payload)).digest("hex")}`;
}

export function verifyRecordHash(payload: AuditHashPayload, expectedHash: string) {
  return createRecordHash(payload).toLowerCase() === expectedHash.toLowerCase();
}

