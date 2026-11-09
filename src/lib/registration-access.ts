import type { UserRole } from "@/db/schema";
import type { RegistrationStatus } from "@/lib/types";

export function requiresStudentRegistrationApproval(role: UserRole) {
  return role === "student";
}

export function canAccessWithRegistrationStatus(role: UserRole, registrationStatus: RegistrationStatus) {
  return !requiresStudentRegistrationApproval(role) || registrationStatus === "approved";
}
