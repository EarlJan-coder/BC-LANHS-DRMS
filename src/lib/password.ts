import bcrypt from "bcryptjs";

// Precomputed bcrypt hash (cost 12) compared against when no user row exists,
// so login response time does not reveal whether an email/LRN is registered.
// It never authenticates anyone: the caller still rejects when user is null.
export const DUMMY_PASSWORD_HASH = "$2b$12$sPo8nWNkXOSkjEUuBBJ2k.Qg6vQ3YJrZTVIOErAMO259wAWxDSI6a";

export async function comparePassword(password: string, userHash: string | null): Promise<boolean> {
  return bcrypt.compare(password, userHash ?? DUMMY_PASSWORD_HASH);
}
