/**
 * API contract types (docs/06). Every response uses the standard envelope
 * `{ data, meta, errors }`. snake_case matches the Laravel JSON output.
 */

export type Locale = 'tr' | 'en' | 'de' | 'ru' | 'ar';

export type Role = 'owner' | 'manager' | 'waiter' | 'kitchen' | 'superadmin';

export interface ApiEnvelope<T> {
  data?: T;
  meta?: Record<string, unknown>;
  errors?: Record<string, string[]>;
  message?: string;
}

export interface PlanSummary {
  code: string;
  name: string;
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  custom_domain: string | null;
  status: 'active' | 'trialing' | 'suspended';
  locale_default: Locale;
  currency: string;
  timezone: string;
  settings: Record<string, unknown>;
  trial_ends_at: string | null;
  plan?: PlanSummary;
  created_at: string;
}

export interface User {
  id: number;
  tenant_id: number | null;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  role_label: string;
  last_login_at: string | null;
  created_at: string;
}

export interface AuthSession {
  user: User;
  tenant: Tenant | null;
  token: string;
}

export interface RegisterTenantResult {
  tenant: Tenant;
  user: User;
  token: string;
  panel_url: string;
}

export interface RegisterTenantPayload {
  business_name: string;
  owner_name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
  slug?: string;
  locale?: Locale;
  currency?: string;
  timezone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  device_name?: string;
}

export interface MeResult {
  user: User;
  tenant: Tenant | null;
}

export interface SlugAvailability {
  slug: string;
  available: boolean;
  reserved: boolean;
}
