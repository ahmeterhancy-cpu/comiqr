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
  two_factor_enabled?: boolean;
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

// --- Menu (M1) + nutrition (M2) ---

export interface NutritionInfo {
  kcal: number;
  macros: { protein_g: number; carb_g: number; fat_g: number };
  detail: { saturated_fat_g: number; sugar_g: number; fiber_g: number; sodium_mg: number };
  allergens: { contains: number[]; traces: number[] };
  diet: { vegan: boolean; vegetarian: boolean; gluten_free: boolean };
  is_stale: boolean;
  computed_at: string | null;
}

export interface MenuVariant {
  id: number;
  name: string;
  price_delta: string | number;
  is_default: boolean;
}

export interface MenuModifier {
  id: number;
  name: string;
  price_delta: string | number;
}

export interface MenuModifierGroup {
  id: number;
  name: string;
  min_select: number;
  max_select: number;
  is_required: boolean;
  modifiers: MenuModifier[];
}

export interface MenuProduct {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  price: string | number;
  images: string[];
  video: string | null;
  is_active: boolean;
  sort: number;
  prep_minutes: number | null;
  tags: string[];
  calories_display: boolean;
  variants: MenuVariant[];
  modifier_groups: MenuModifierGroup[];
  nutrition: NutritionInfo | null;
}

export interface MenuCategory {
  id: number;
  parent_id: number | null;
  branch_id: number | null;
  name: string;
  sort: number;
  is_active: boolean;
  image_path: string | null;
  products: MenuProduct[];
}

export interface AllergenRef {
  id: number;
  code: string;
  name: string;
  icon: string | null;
}

export interface MenuVenue {
  name: string;
  locale_default: Locale;
  currency: string;
  sub_title?: string | null;
  timing?: string | null;
  description?: string | null;
  address?: string | null;
  logo?: string | null;
  cover?: string | null;
  theme?: 'classic' | 'flipbook' | 'modern';
}

export interface Menu {
  venue: MenuVenue;
  allergens: AllergenRef[];
  categories: MenuCategory[];
}

// --- Consumer discovery portal (M20) ---

export interface DiscoverVenue {
  slug: string;
  name: string;
  currency: string;
  product_count: number;
  samples: { name: string; image: string | null }[];
}
