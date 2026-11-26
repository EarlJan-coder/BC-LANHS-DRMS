/**
 * Only the fields whose value differs from the loaded certificate view.
 *
 * The PATCH /api/certificates/[id] contract is provided-key based: a missing
 * key leaves the stored override untouched, while every provided key writes an
 * override (and therefore an "edited" pill). Sending the whole form would
 * store overrides for the seven fields the registrar never touched, so the
 * editor sends exactly what changed — and nothing when nothing did.
 */
export function changedCertificateFields<T extends object>(current: T, loaded: T): Partial<T> {
  const changed: Partial<T> = {};
  for (const key of Object.keys(current) as Array<keyof T>) {
    if (current[key] !== loaded[key]) {
      changed[key] = current[key];
    }
  }
  return changed;
}
