/**
 * Strong password policy shared by the sign-up and change-password flows and
 * by the temporary-password generator. Every requirement here must hold for a
 * password to be accepted: 8-72 characters including an uppercase letter, a
 * lowercase letter, a number, and a symbol. The generator and the form
 * checklists read the same list, so the policy has a single source of truth.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export type PasswordRequirementKey = "length" | "uppercase" | "lowercase" | "number" | "symbol";

export type PasswordRequirement = {
  key: PasswordRequirementKey;
  label: string;
  message: string;
  isMet: (password: string) => boolean;
};

export const PASSWORD_REQUIREMENTS: readonly PasswordRequirement[] = [
  {
    key: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    isMet: (password) => password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
  },
  {
    key: "uppercase",
    label: "An uppercase letter",
    message: "Password must include an uppercase letter.",
    isMet: (password) => /[A-Z]/.test(password),
  },
  {
    key: "lowercase",
    label: "A lowercase letter",
    message: "Password must include a lowercase letter.",
    isMet: (password) => /[a-z]/.test(password),
  },
  {
    key: "number",
    label: "A number",
    message: "Password must include a number.",
    isMet: (password) => /[0-9]/.test(password),
  },
  {
    key: "symbol",
    label: "A symbol (e.g. ! @ # $)",
    message: "Password must include a symbol (e.g. ! @ # $).",
    isMet: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function passwordRequirements(password: string): Record<PasswordRequirementKey, boolean> {
  const result = {} as Record<PasswordRequirementKey, boolean>;
  for (const requirement of PASSWORD_REQUIREMENTS) {
    result[requirement.key] = requirement.isMet(password);
  }
  return result;
}

export function meetsPasswordPolicy(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((requirement) => requirement.isMet(password));
}
