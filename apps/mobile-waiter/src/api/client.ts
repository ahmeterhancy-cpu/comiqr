import { API_BASE } from '@/constants/config';

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;
  constructor(message: string, status: number, errors: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
}

/**
 * Thin fetch wrapper for the Laravel API. Unwraps the `{ data }` envelope,
 * surfaces `{ message, errors }` on failure, and fires the global 401 handler so
 * an expired token logs the waiter out (registered in app/_layout.tsx to avoid a
 * circular import with the auth store).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = 15_000 } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(`İstek zaman aşımı (${Math.round(timeoutMs / 1000)}s)`, 0);
    }
    throw new ApiError(err instanceof Error ? err.message : 'Ağ hatası', 0);
  }
  clearTimeout(timeoutId);

  const text = await response.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && token && onUnauthorized) {
      try {
        onUnauthorized();
      } catch {
        /* ignore */
      }
    }
    throw new ApiError(json?.message ?? `HTTP ${response.status}`, response.status, json?.errors ?? {});
  }

  return (json?.data ?? json) as T;
}

// Global 401 handler — set from app/_layout.tsx (avoids a circular auth-store import).
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb;
}
