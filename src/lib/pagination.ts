export const PAGE_SIZE = 20;

export type Paged<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
};

export function normalizePage(page: number, total: number, pageSize = PAGE_SIZE) {
  const safePageSize = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / safePageSize));
  const safePage = Number.isFinite(page) ? Math.min(totalPages, Math.max(1, Math.floor(page))) : 1;
  return { page: safePage, pageSize: safePageSize };
}

export function makePaged<T>(rows: T[], total: number, page: number, pageSize = PAGE_SIZE): Paged<T> {
  const normalized = normalizePage(page, total, pageSize);
  return { rows, total, ...normalized };
}

export function paginateRows<T>(rows: readonly T[], page = 1, pageSize = PAGE_SIZE): Paged<T> {
  const { page: safePage, pageSize: safePageSize } = normalizePage(page, rows.length, pageSize);
  const start = (safePage - 1) * safePageSize;
  return { rows: rows.slice(start, start + safePageSize), total: rows.length, page: safePage, pageSize: safePageSize };
}

export function parsePage(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}
