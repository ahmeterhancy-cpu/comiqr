/**
 * Minimal typed API client for the ComiQR REST API (docs/06). Framework-agnostic
 * (uses global fetch); Next apps supply token/tenant per request or per instance.
 */
import type {
  ApiEnvelope,
  AuthSession,
  LoginPayload,
  Menu,
  MeResult,
  RegisterTenantPayload,
  RegisterTenantResult,
  SlugAvailability,
  Tenant,
} from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** First validation message for a field, if any. */
  first(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  token?: string | null;
  tenant?: string | null;
  locale?: string;
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null;
  private tenant: string | null;
  private locale?: string;

  constructor(opts: ApiClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.token = opts.token ?? null;
    this.tenant = opts.tenant ?? null;
    this.locale = opts.locale;
  }

  withToken(token: string | null): this {
    this.token = token;
    return this;
  }

  withTenant(slug: string | null): this {
    this.tenant = slug;
    return this;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    if (this.tenant) headers.set('X-Tenant', this.tenant);
    if (this.locale) headers.set('Accept-Language', this.locale);

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });

    let body: ApiEnvelope<T> | null = null;
    try {
      body = (await res.json()) as ApiEnvelope<T>;
    } catch {
      // no/invalid JSON body
    }

    if (!res.ok) {
      throw new ApiError(
        res.status,
        body?.message ?? `Request failed (${res.status})`,
        body?.errors ?? {},
      );
    }

    return (body?.data ?? (body as unknown)) as T;
  }

  // --- Auth (docs/06 §6.1) ---
  registerTenant(payload: RegisterTenantPayload): Promise<RegisterTenantResult> {
    return this.request('/auth/register-tenant', { method: 'POST', body: JSON.stringify(payload) });
  }

  login(payload: LoginPayload): Promise<AuthSession> {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  }

  logout(): Promise<{ message: string }> {
    return this.request('/auth/logout', { method: 'POST' });
  }

  me(): Promise<MeResult> {
    return this.request('/auth/me');
  }

  slugAvailable(slug: string): Promise<SlugAvailability> {
    return this.request(`/auth/slug-available/${encodeURIComponent(slug)}`);
  }

  /** Public menu (M1/M4). Tenant is taken from the instance (X-Tenant) or slug arg. */
  menu(slug?: string): Promise<Menu> {
    const query = slug ? `?tenant=${encodeURIComponent(slug)}` : '';
    return this.request(`/menu${query}`);
  }

  // --- Tenant (docs/06 §6.1) ---
  getTenant(): Promise<Tenant> {
    return this.request('/tenant');
  }

  updateTenant(patch: Partial<Pick<Tenant, 'name' | 'locale_default' | 'currency' | 'timezone'>> & {
    settings_json?: Record<string, unknown>;
  }): Promise<Tenant> {
    return this.request('/tenant', { method: 'PATCH', body: JSON.stringify(patch) });
  }
}
