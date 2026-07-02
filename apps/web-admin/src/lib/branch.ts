'use client';

const KEY = 'comiqr.admin.branch';

export function getActiveBranchId(): number | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(KEY);
  return v ? Number(v) : null;
}

export function setActiveBranchId(id: number): void {
  window.localStorage.setItem(KEY, String(id));
}
