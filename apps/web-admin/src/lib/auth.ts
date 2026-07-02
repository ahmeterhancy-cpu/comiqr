'use client';

import type { User } from '@comiqr/shared-types';

// Faz 0: client-side session (localStorage). Sanctum token is a bearer token;
// a later phase can move it to an httpOnly cookie via route handlers.
const TOKEN_KEY = 'comiqr.admin.token';
const USER_KEY = 'comiqr.admin.user';
// Snapshot of the superadmin session saved while impersonating a tenant, so the
// operator can return to the platform console without re-authenticating.
const IMPERSONATOR_KEY = 'comiqr.admin.impersonator';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: User): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(IMPERSONATOR_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/** Save the current (superadmin) session before switching into a tenant. */
export function startImpersonation(): void {
  const token = getToken();
  const user = getUser();
  if (token && user) {
    window.localStorage.setItem(IMPERSONATOR_KEY, JSON.stringify({ token, user }));
  }
}

export function getImpersonator(): { token: string; user: User } | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(IMPERSONATOR_KEY);
  return raw ? (JSON.parse(raw) as { token: string; user: User }) : null;
}

/** Restore the saved superadmin session. Returns false if none was saved. */
export function returnToImpersonator(): boolean {
  const imp = getImpersonator();
  window.localStorage.removeItem(IMPERSONATOR_KEY);
  if (!imp) return false;
  setSession(imp.token, imp.user);
  return true;
}
