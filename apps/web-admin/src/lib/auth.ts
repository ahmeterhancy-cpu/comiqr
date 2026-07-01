'use client';

import type { User } from '@comiqr/shared-types';

// Faz 0: client-side session (localStorage). Sanctum token is a bearer token;
// a later phase can move it to an httpOnly cookie via route handlers.
const TOKEN_KEY = 'comiqr.admin.token';
const USER_KEY = 'comiqr.admin.user';

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
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}
