import { randomBytes } from "crypto";

/**
 * Generate a random alphanumeric temporary password.
 * Uses an uppercase + digits alphabet with the ambiguous characters
 * (I, O, 0, 1) removed so the admin can read it aloud if needed.
 */
export function generateTemporaryPassword(length = 12): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}
