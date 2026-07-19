/**
 * API contract types (docs/06). Every response uses the standard envelope
 * `{ data, meta, errors }`. snake_case matches the Laravel JSON output.
 */

export type Locale = 'tr' | 'en' | 'de' | 'ru' | 'ar';

export type Role = 'owner' | 'manager' | 'waiter' | 'kitchen' | 'cashier' | 'superadmin';

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
  plan?: string;
  vertical?: string;
}

export interface PlanOption {
  code: string;
  name: string;
  price_monthly: number | string;
  price_yearly: number | string;
  currency: string;
  verticals: string[];
  features: Record<string, unknown>;
  limits: Record<string, number>;
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

export type StaffRole = 'manager' | 'waiter' | 'kitchen' | 'cashier';

export interface StaffUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole | 'owner';
  role_label: string;
  is_active: boolean;
  is_owner: boolean;
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
  /** Pre-discount price when the category has an active promotion (for strike-through). */
  original_price?: string | number;
  images: string[];
  video: string | null;
  is_active: boolean;
  age_restricted?: boolean;
  sort: number;
  prep_minutes: number | null;
  tags: string[];
  calories_display: boolean;
  variants: MenuVariant[];
  modifier_groups: MenuModifierGroup[];
  nutrition: NutritionInfo | null;
  /** Ingredient recipe (name + amount) shown in the product detail; empty/absent when not entered. */
  recipe?: { name: string; quantity: number; unit: string }[];
}

export interface MenuCategory {
  id: number;
  parent_id: number | null;
  branch_id: number | null;
  name: string;
  sort: number;
  is_active: boolean;
  image_path: string | null;
  /** Category promotion — a percent discount applied to all its products. */
  promo?: { active: boolean; percent: number; label: string | null };
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
  slug?: string;
  locale_default: Locale;
  currency: string;
  sub_title?: string | null;
  timing?: string | null;
  /** Whether the venue is open right now (computed from `hours`/`timing` in the tenant tz). null = unknown. */
  open_now?: boolean | null;
  /** Per-day working hours, index 0=Mon..6=Sun; `today` marks the current day (tenant tz). null when not configured. */
  hours?: { closed: boolean; open: string | null; close: string | null; today: boolean }[] | null;
  description?: string | null;
  address?: string | null;
  logo?: string | null;
  cover?: string | null;
  theme?: 'classic' | 'flipbook' | 'modern';
  vertical?: 'restaurant' | 'hotel' | 'bar' | 'beach';
  happy_hour?: { active: boolean; percent: number };
  /** Menu display toggle — when false, the guest menu hides all prices. */
  show_prices?: boolean;
  /** Owner-picked menu colours (Menu Builder) — override the theme's text/background/accent. */
  menu_text_color?: string | null;
  menu_page_color?: string | null;
  /** Accent for buttons, active pills and the order bar. */
  menu_button_color?: string | null;
  /** Menu Builder element toggles (default on). */
  show_hours?: boolean;
  show_search?: boolean;
  show_allergens?: boolean;
  show_cart?: boolean;
  show_call_waiter?: boolean;
  show_bill?: boolean;
  rating?: number;
  reviews_count?: number;
  brand_color?: string | null;
  powered_by?: boolean;
  /** Guest AI menu assistant available (plan has AI + provider configured). */
  ai_chat?: boolean;
  // Contact + social + guest WiFi — all optional, shown on the menu only when set.
  email?: string | null;
  website?: string | null;
  phone?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  x?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  whatsapp?: string | null;
  wifi_ssid?: string | null;
  wifi_password?: string | null;
  /** Table service (call waiter / request bill) enabled by the owner. */
  allow_call_waiter?: boolean;
  /** "Add to cart" ordering available (plan + at least one order channel enabled). */
  can_order?: boolean;
}

export interface MenuTable {
  id: number;
  code: string;
  qr_token: string;
  area_type?: AreaType | null;
  is_room?: boolean;
}

export interface Menu {
  venue: MenuVenue;
  allergens: AllergenRef[];
  categories: MenuCategory[];
  /** Present only on the QR-token menu entry (GET /menu/{qrToken}). */
  table?: MenuTable;
  /** Active table codes for the slug menu's "pick a table → call waiter/bill" flow. */
  tables?: string[];
}

// --- Hotel vertical (Faz 3) — front-desk room folio ---

export interface HotelFolioOrder {
  id: number;
  grand_total: number;
  items_count: number;
  placed_at: string | null;
}

export interface HotelFolioRoom {
  table_id: number;
  code: string;
  area: string | null;
  area_type?: AreaType | null;
  order_count: number;
  total: number;
  orders: HotelFolioOrder[];
}

// --- Dining areas / tables (M3) ---

export type AreaType = 'table' | 'room' | 'sunbed' | 'stand';

export interface DiningArea {
  id: number;
  branch_id: number | null;
  name: string;
  type: AreaType;
  tables_count?: number;
}

// --- Consumer discovery portal (M20) ---

export interface DiscoverVenue {
  slug: string;
  name: string;
  currency: string;
  product_count: number;
  rating?: number;
  reviews_count?: number;
  samples: { name: string; image: string | null }[];
}

// --- Reviews + reputation (Faz 3) ---

export interface Review {
  id: number;
  order_id: number;
  rating: number;
  comment: string | null;
  reply: string | null;
  status: 'published' | 'hidden';
  created_at: string;
}

export interface Reputation {
  average: number;
  count: number;
  distribution: Record<number, number>;
}

export interface PublicReview {
  rating: number;
  comment: string | null;
  reply: string | null;
  created_at: string;
}
