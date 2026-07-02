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
    const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
    if (init.body && !isForm && !headers.has('Content-Type')) {
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

  // --- Admin: menu management (M1/M2, docs/06 §6.5/§6.6) ---
  adminCategories(): Promise<any[]> {
    return this.request('/admin/categories');
  }
  createCategory(body: Record<string, unknown>): Promise<any> {
    return this.request('/admin/categories', { method: 'POST', body: JSON.stringify(body) });
  }
  updateCategory(id: number, body: Record<string, unknown>): Promise<any> {
    return this.request(`/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  deleteCategory(id: number): Promise<any> {
    return this.request(`/admin/categories/${id}`, { method: 'DELETE' });
  }
  adminProducts(categoryId?: number): Promise<any[]> {
    return this.request(`/admin/products${categoryId ? `?category_id=${categoryId}` : ''}`);
  }
  createProduct(body: Record<string, unknown>): Promise<any> {
    return this.request('/admin/products', { method: 'POST', body: JSON.stringify(body) });
  }
  updateProduct(id: number, body: Record<string, unknown>): Promise<any> {
    return this.request(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  deleteProduct(id: number): Promise<any> {
    return this.request(`/admin/products/${id}`, { method: 'DELETE' });
  }
  uploadProductImage(id: number, file: File): Promise<any> {
    const form = new FormData();
    form.append('image', file);
    return this.request(`/admin/products/${id}/media`, { method: 'POST', body: form });
  }
  addVariant(productId: number, body: Record<string, unknown>): Promise<any> {
    return this.request(`/admin/products/${productId}/variants`, { method: 'POST', body: JSON.stringify(body) });
  }
  deleteVariant(productId: number, variantId: number): Promise<any> {
    return this.request(`/admin/products/${productId}/variants/${variantId}`, { method: 'DELETE' });
  }
  adminIngredients(q?: string): Promise<any[]> {
    return this.request(`/admin/ingredients${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  }
  createIngredient(body: Record<string, unknown>): Promise<any> {
    return this.request('/admin/ingredients', { method: 'POST', body: JSON.stringify(body) });
  }
  getRecipe(productId: number): Promise<any> {
    return this.request(`/admin/products/${productId}/recipe`);
  }
  putRecipe(productId: number, body: Record<string, unknown>): Promise<any> {
    return this.request(`/admin/products/${productId}/recipe`, { method: 'PUT', body: JSON.stringify(body) });
  }
  productNutrition(productId: number): Promise<any> {
    return this.request(`/admin/products/${productId}/nutrition`);
  }

  // --- Admin: tables / QR (M3) ---
  adminTables(): Promise<any[]> {
    return this.request('/admin/tables');
  }
  createTable(body: Record<string, unknown>): Promise<any> {
    return this.request('/admin/tables', { method: 'POST', body: JSON.stringify(body) });
  }
  bulkTables(body: Record<string, unknown>): Promise<any[]> {
    return this.request('/admin/tables/bulk', { method: 'POST', body: JSON.stringify(body) });
  }

  adminBranches(): Promise<any[]> {
    return this.request('/admin/branches');
  }
  createBranch(body: Record<string, unknown>): Promise<any> {
    return this.request('/admin/branches', { method: 'POST', body: JSON.stringify(body) });
  }
  updateBranch(id: number, body: Record<string, unknown>): Promise<any> {
    return this.request(`/admin/branches/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  deleteBranch(id: number): Promise<any> {
    return this.request(`/admin/branches/${id}`, { method: 'DELETE' });
  }
  adminAllergens(): Promise<any[]> {
    return this.request('/admin/allergens');
  }

  // --- CRM / coupons (M8) ---
  adminCustomers(): Promise<any[]> {
    return this.request('/admin/customers');
  }
  adminCoupons(): Promise<any[]> {
    return this.request('/admin/coupons');
  }
  createCoupon(body: Record<string, unknown>): Promise<any> {
    return this.request('/admin/coupons', { method: 'POST', body: JSON.stringify(body) });
  }
  deleteCoupon(id: number): Promise<any> {
    return this.request(`/admin/coupons/${id}`, { method: 'DELETE' });
  }

  // --- AI (M7) ---
  aiProductCopy(productId: number, save = true): Promise<any> {
    return this.request('/admin/ai/product-copy', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, save }),
    });
  }
  aiTranslateMenu(locale: string, productIds?: number[]): Promise<any> {
    return this.request('/admin/ai/translate-menu', {
      method: 'POST',
      body: JSON.stringify({ locale, product_ids: productIds }),
    });
  }

  // --- Admin: analytics (M9) ---
  analyticsOverview(branchId?: number): Promise<any> {
    return this.request(`/admin/analytics/overview${branchId ? `?branch_id=${branchId}` : ''}`);
  }

  // --- Superadmin (M12) ---
  superTenants(): Promise<any[]> {
    return this.request('/superadmin/tenants');
  }
  superUpdateTenant(id: number, body: Record<string, unknown>): Promise<any> {
    return this.request(`/superadmin/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  superImpersonate(id: number): Promise<{ token: string; tenant: any; user: any }> {
    return this.request(`/superadmin/tenants/${id}/impersonate`, { method: 'POST' });
  }
  superAuditLogs(): Promise<any[]> {
    return this.request('/superadmin/audit-logs');
  }

  // --- KDS / live orders (M6, docs/06 §6.7) ---
  kdsOrders(branchId: number, station?: number): Promise<any[]> {
    return this.request(`/kds/${branchId}/orders${station ? `?station=${station}` : ''}`);
  }
  kdsItemStatus(itemId: number, status: string): Promise<any> {
    return this.request(`/kds/order-items/${itemId}/status`, { method: 'POST', body: JSON.stringify({ status }) });
  }
  kdsBump(itemId: number): Promise<any> {
    return this.request(`/kds/order-items/${itemId}/bump`, { method: 'POST' });
  }
  eightySix(branchId: number, productId: number): Promise<any> {
    return this.request('/kds/eighty-six', {
      method: 'POST',
      body: JSON.stringify({ branch_id: branchId, product_id: productId }),
    });
  }

  updateTenant(patch: Partial<Pick<Tenant, 'name' | 'locale_default' | 'currency' | 'timezone'>> & {
    settings_json?: Record<string, unknown>;
  }): Promise<Tenant> {
    return this.request('/tenant', { method: 'PATCH', body: JSON.stringify(patch) });
  }
}
