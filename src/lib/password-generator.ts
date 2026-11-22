import { randomInt } from "crypto";

/**
 * Generate a random temporary password that satisfies the strong password
 * policy (uppercase, lowercase, number, and symbol). Ambiguous characters
 * (I, l, O, 0, 1) are excluded from every class so the admin can read the
 * password aloud if needed.
 */
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*?-_=+";
const ALL_CHARACTERS = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;

function pick(charset: string): string {
  return charset[randomInt(charset.length)];
}

export function generateTemporaryPassword(length = 12): string {
  if (length < 8) {
    throw new Error("Temporary passwords must be at least 8 characters.");
  }

  // Guarantee one character from each class, then fill and shuffle so the
  // class positions are not predictable.
  const characters = [pick(UPPERCASE), pick(LOWERCASE), pick(DIGITS), pick(SYMBOLS)];
  while (characters.length < length) {
    characters.push(pick(ALL_CHARACTERS));
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
}
