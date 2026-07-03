/**
 * Minimal typed API client for the ComiQR REST API (docs/06). Framework-agnostic
 * (uses global fetch); Next apps supply token/tenant per request or per instance.
 */
import type {
  ApiEnvelope,
  AuthSession,
  DiscoverVenue,
  HotelFolioRoom,
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

  // --- Two-factor auth (M12) ---
  enableTwoFactor(): Promise<{ secret: string; otpauth_uri: string }> {
    return this.request('/auth/2fa/enable', { method: 'POST' });
  }
  confirmTwoFactor(code: string): Promise<{ two_factor_enabled: boolean }> {
    return this.request('/auth/2fa/confirm', { method: 'POST', body: JSON.stringify({ code }) });
  }
  verifyTwoFactor(code: string): Promise<{ verified: boolean }> {
    return this.request('/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ code }) });
  }
  disableTwoFactor(code: string): Promise<{ two_factor_enabled: boolean }> {
    return this.request('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ code }) });
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

  /** Public consumer discovery portal (M20) — active venues with a live menu. */
  discover(q?: string): Promise<DiscoverVenue[]> {
    return this.request(`/discover${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  }

  /** Package-service (delivery/takeaway) order for a venue by slug (M20). */
  venueOrder(slug: string, body: Record<string, unknown>): Promise<any> {
    return this.request(`/venues/${encodeURIComponent(slug)}/orders`, { method: 'POST', body: JSON.stringify(body) });
  }

  /** A customer's saved cards at a venue (masked; identified by phone). */
  venueCards(slug: string, phone: string): Promise<{ id: number; alias: string | null; last4: string | null }[]> {
    return this.request(`/venues/${encodeURIComponent(slug)}/cards?phone=${encodeURIComponent(phone)}`);
  }

  /** Hotel: defer an order onto the room's folio instead of paying now (Faz 3). */
  chargeToRoom(qrToken: string, orderId: number): Promise<any> {
    return this.request(`/sessions/${encodeURIComponent(qrToken)}/orders/${orderId}/charge-to-room`, { method: 'POST' });
  }

  // --- Tenant (docs/06 §6.1) ---
  getTenant(): Promise<Tenant> {
    return this.request('/tenant');
  }
  uploadRestaurantMedia(type: 'logo' | 'cover', file: File): Promise<{ type: string; url: string }> {
    const form = new FormData();
    form.append('type', type);
    form.append('image', file);
    return this.request('/tenant/media', { method: 'POST', body: form });
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

  // --- Admin: modifier groups (M1) ---
  adminModifierGroups(): Promise<any[]> {
    return this.request('/admin/modifier-groups');
  }
  createModifierGroup(body: Record<string, unknown>): Promise<any> {
    return this.request('/admin/modifier-groups', { method: 'POST', body: JSON.stringify(body) });
  }
  updateModifierGroup(id: number, body: Record<string, unknown>): Promise<any> {
    return this.request(`/admin/modifier-groups/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  deleteModifierGroup(id: number): Promise<any> {
    return this.request(`/admin/modifier-groups/${id}`, { method: 'DELETE' });
  }
  addModifier(groupId: number, body: Record<string, unknown>): Promise<any> {
    return this.request(`/admin/modifier-groups/${groupId}/modifiers`, { method: 'POST', body: JSON.stringify(body) });
  }
  deleteModifier(groupId: number, modifierId: number): Promise<any> {
    return this.request(`/admin/modifier-groups/${groupId}/modifiers/${modifierId}`, { method: 'DELETE' });
  }
  attachModifierGroup(productId: number, groupId: number): Promise<any> {
    return this.request(`/admin/products/${productId}/modifier-groups`, {
      method: 'POST',
      body: JSON.stringify({ modifier_group_id: groupId }),
    });
  }
  detachModifierGroup(productId: number, groupId: number): Promise<any> {
    return this.request(`/admin/products/${productId}/modifier-groups/${groupId}`, { method: 'DELETE' });
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

  // --- Hotel vertical (Faz 3) — front-desk room folio + check-out settle ---
  hotelFolio(branchId?: number): Promise<HotelFolioRoom[]> {
    return this.request(`/admin/hotel/folio${branchId ? `?branch_id=${branchId}` : ''}`);
  }
  settleRoom(tableId: number): Promise<{ table_id: number; settled_count: number; settled_total: number }> {
    return this.request(`/admin/hotel/rooms/${tableId}/settle`, { method: 'POST' });
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

  // --- Campaigns (M8) ---
  adminCampaigns(): Promise<any[]> {
    return this.request('/admin/campaigns');
  }
  createCampaign(body: Record<string, unknown>): Promise<any> {
    return this.request('/admin/campaigns', { method: 'POST', body: JSON.stringify(body) });
  }
  deleteCampaign(id: number): Promise<any> {
    return this.request(`/admin/campaigns/${id}`, { method: 'DELETE' });
  }
  sendCampaign(id: number): Promise<any> {
    return this.request(`/admin/campaigns/${id}/send`, { method: 'POST' });
  }

  // --- External integrations (POS/ÖKC/ERP/delivery) ---
  adminIntegrations(): Promise<any[]> {
    return this.request('/admin/integrations');
  }
  createIntegration(body: Record<string, unknown>): Promise<any> {
    return this.request('/admin/integrations', { method: 'POST', body: JSON.stringify(body) });
  }
  updateIntegration(id: number, body: Record<string, unknown>): Promise<any> {
    return this.request(`/admin/integrations/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  deleteIntegration(id: number): Promise<any> {
    return this.request(`/admin/integrations/${id}`, { method: 'DELETE' });
  }
  testIntegration(id: number): Promise<{ ok: boolean }> {
    return this.request(`/admin/integrations/${id}/test`, { method: 'POST' });
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
  analyticsHeatmap(branchId?: number): Promise<any> {
    return this.request(`/admin/analytics/heatmap${branchId ? `?branch_id=${branchId}` : ''}`);
  }

  // --- Superadmin (M12) ---
  superOverview(): Promise<any> {
    return this.request('/superadmin/overview');
  }
  superTransactions(): Promise<any[]> {
    return this.request('/superadmin/transactions');
  }
  superAllergens(): Promise<any[]> {
    return this.request('/superadmin/allergens');
  }
  superCreateAllergen(body: Record<string, unknown>): Promise<any> {
    return this.request('/superadmin/allergens', { method: 'POST', body: JSON.stringify(body) });
  }
  superDeleteAllergen(id: number): Promise<any> {
    return this.request(`/superadmin/allergens/${id}`, { method: 'DELETE' });
  }
  superPlans(): Promise<any[]> {
    return this.request('/superadmin/plans');
  }
  superUpdatePlan(id: number, body: Record<string, unknown>): Promise<any> {
    return this.request(`/superadmin/plans/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  superTenantDetail(id: number): Promise<any> {
    return this.request(`/superadmin/tenants/${id}`);
  }
  superUsers(q: string): Promise<any[]> {
    return this.request(`/superadmin/users?q=${encodeURIComponent(q)}`);
  }
  superTenants(): Promise<any[]> {
    return this.request('/superadmin/tenants');
  }
  superUpdateTenant(id: number, body: Record<string, unknown>): Promise<any> {
    return this.request(`/superadmin/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  superDeleteTenant(id: number): Promise<any> {
    return this.request(`/superadmin/tenants/${id}`, { method: 'DELETE' });
  }
  superStartSubscription(id: number, body: Record<string, unknown>): Promise<any> {
    return this.request(`/superadmin/tenants/${id}/subscription`, { method: 'POST', body: JSON.stringify(body) });
  }
  superUpdateRestaurant(id: number, body: Record<string, unknown>): Promise<any> {
    return this.request(`/superadmin/tenants/${id}/restaurant`, { method: 'PATCH', body: JSON.stringify(body) });
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
