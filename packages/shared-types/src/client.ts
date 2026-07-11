/**
 * Minimal typed API client for the ComiQR REST API (docs/06). Framework-agnostic
 * (uses global fetch); Next apps supply token/tenant per request or per instance.
 */
import type {
  ApiEnvelope,
  AreaType,
  AuthSession,
  DiningArea,
  DiscoverVenue,
  HotelFolioRoom,
  LoginPayload,
  Menu,
  MeResult,
  PlanOption,
  PublicReview,
  RegisterTenantPayload,
  Reputation,
  Review,
  RegisterTenantResult,
  SlugAvailability,
  StaffRole,
  StaffUser,
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

  /** Public SaaS plans for the onboarding plan picker (code/price/verticals). */
  plans(): Promise<PlanOption[]> {
    return this.request('/plans');
  }

  /** Owner's current trial/subscription status (billing page). */
  subscriptionStatus(): Promise<{
    tenant_status: string;
    trial_ends_at: string | null;
    plan_code: string | null;
    plan_name: string | null;
    owner_phone: string | null;
    subscription: {
      status: string;
      billing_cycle: string;
      current_period_end: string | null;
      grace_ends_at: string | null;
      card_last4?: string | null;
      card_brand?: string | null;
    } | null;
  }> {
    return this.request('/subscription');
  }

  /**
   * Begin card-on-page subscription checkout. Returns a Tiko pay3d session (url +
   * hidden fields) — the browser adds the card fields and posts them straight to
   * Tiko, so card data never touches our server.
   */
  subscribe(body: { plan: string; billing_cycle?: 'monthly' | 'yearly'; phone?: string }): Promise<{
    subscription: { plan: string; status: string; billing_cycle: string; amount: number; currency: string };
    session: { kind: string; url: string; ref: string; meta: { fields: Record<string, string> } };
  }> {
    return this.request('/subscription', { method: 'POST', body: JSON.stringify(body) });
  }

  /** Set regional settings (currency/timezone/locale) from a country — onboarding. */
  setRegion(country: string): Promise<{ country: string; currency: string; timezone: string; locale: string }> {
    return this.request('/tenant/region', { method: 'POST', body: JSON.stringify({ country }) });
  }

  // --- Staff / sub-users (owner & managers) ---
  staff(): Promise<StaffUser[]> {
    return this.request('/staff');
  }

  createStaff(body: { name: string; email: string; phone?: string; password: string; role: StaffRole }): Promise<StaffUser> {
    return this.request('/staff', { method: 'POST', body: JSON.stringify(body) });
  }

  updateStaff(id: number, body: Partial<{ name: string; phone: string; role: StaffRole; is_active: boolean; password: string }>): Promise<StaffUser> {
    return this.request(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  deleteStaff(id: number): Promise<{ deleted: boolean }> {
    return this.request(`/staff/${id}`, { method: 'DELETE' });
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

  /** Guest AI menu assistant — answers strictly from the menu. 402 if plan lacks AI, 503 if unconfigured. */
  menuChat(
    slug: string | undefined,
    question: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
    locale?: string,
  ): Promise<{ answer: string }> {
    const query = slug ? `?tenant=${encodeURIComponent(slug)}` : '';
    return this.request(`/menu/chat${query}`, {
      method: 'POST',
      body: JSON.stringify({ question, history, locale }),
    });
  }

  /** Baskıya hazır menü PDF'ini (sunucu-taraflı dompdf) ham blob olarak indirir. */
  async downloadMenuPdf(): Promise<Blob> {
    const headers = new Headers({ Accept: 'application/pdf' });
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    const res = await fetch(`${this.baseUrl}/admin/menu/pdf`, { headers });
    if (!res.ok) throw new ApiError(res.status, `PDF oluşturulamadı (${res.status})`, {});
    return res.blob();
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

  /** Leave a review (rating + comment) for an order — one per order (Faz 3). */
  submitReview(
    qrToken: string,
    orderId: number,
    body: { rating: number; comment?: string; customer?: { phone?: string; name?: string } },
  ): Promise<Review> {
    return this.request(`/sessions/${encodeURIComponent(qrToken)}/orders/${orderId}/review`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /** Public recent reviews + reputation for a venue (Faz 3). */
  venueReviews(slug: string): Promise<{ reviews: PublicReview[]; reputation: Reputation }> {
    return this.request(`/venues/${encodeURIComponent(slug)}/reviews`);
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
  /** AI menu import — extract categories/products from up to 5 photos or a PDF. */
  importMenuFromPhotos(files: File[]): Promise<{ categories: number; products: number }> {
    const form = new FormData();
    files.forEach((f) => form.append('files[]', f));
    return this.request('/admin/ai/import-menu', { method: 'POST', body: form });
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

  // --- Dining areas (M3) — group tables/rooms/sunbeds/stands ---
  adminDiningAreas(): Promise<DiningArea[]> {
    return this.request('/admin/dining-areas');
  }
  createDiningArea(body: { name: string; type?: AreaType; branch_id?: number }): Promise<DiningArea> {
    return this.request('/admin/dining-areas', { method: 'POST', body: JSON.stringify(body) });
  }
  updateDiningArea(id: number, body: Record<string, unknown>): Promise<DiningArea> {
    return this.request(`/admin/dining-areas/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  deleteDiningArea(id: number): Promise<{ deleted: boolean }> {
    return this.request(`/admin/dining-areas/${id}`, { method: 'DELETE' });
  }

  // --- Hotel vertical (Faz 3) — front-desk room folio + check-out settle ---
  hotelFolio(branchId?: number): Promise<HotelFolioRoom[]> {
    return this.request(`/admin/hotel/folio${branchId ? `?branch_id=${branchId}` : ''}`);
  }
  settleRoom(tableId: number): Promise<{ table_id: number; settled_count: number; settled_total: number }> {
    return this.request(`/admin/hotel/rooms/${tableId}/settle`, { method: 'POST' });
  }

  // --- Reviews (Faz 3) — list + reputation, reply, moderate ---
  adminReviews(): Promise<{ reviews: Review[]; reputation: Reputation }> {
    return this.request('/admin/reviews');
  }
  replyReview(id: number, reply: string): Promise<Review> {
    return this.request(`/admin/reviews/${id}/reply`, { method: 'POST', body: JSON.stringify({ reply }) });
  }
  setReviewStatus(id: number, status: 'published' | 'hidden'): Promise<Review> {
    return this.request(`/admin/reviews/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
  }

  // --- Staff POS (Faz 3 — ultra POS) — build, recall, discount, void, settle ---
  posOrders(params?: { scope?: 'open' | 'today'; branch_id?: number }): Promise<any[]> {
    const q = new URLSearchParams();
    if (params?.scope) q.set('scope', params.scope);
    if (params?.branch_id) q.set('branch_id', String(params.branch_id));
    const qs = q.toString();
    return this.request(`/admin/pos/orders${qs ? `?${qs}` : ''}`);
  }
  posOrder(body: { table_id?: number; branch_id?: number; items: unknown[]; note?: string }): Promise<any> {
    return this.request('/admin/pos/orders', { method: 'POST', body: JSON.stringify(body) });
  }
  posAddItems(orderId: number, items: unknown[]): Promise<any> {
    return this.request(`/admin/pos/orders/${orderId}/items`, { method: 'POST', body: JSON.stringify({ items }) });
  }
  posVoidItem(orderId: number, itemId: number): Promise<any> {
    return this.request(`/admin/pos/orders/${orderId}/items/${itemId}/void`, { method: 'POST' });
  }
  posDiscount(orderId: number, body: { type: 'percent' | 'amount'; value: number; reason?: string }): Promise<any> {
    return this.request(`/admin/pos/orders/${orderId}/discount`, { method: 'POST', body: JSON.stringify(body) });
  }
  posLineDiscount(orderId: number, itemId: number, body: { type: 'percent' | 'amount'; value: number }): Promise<any> {
    return this.request(`/admin/pos/orders/${orderId}/items/${itemId}/discount`, { method: 'POST', body: JSON.stringify(body) });
  }
  posChargeRoom(orderId: number): Promise<any> {
    return this.request(`/admin/pos/orders/${orderId}/charge-to-room`, { method: 'POST' });
  }
  posPay(orderId: number, gateway: 'cash' | 'card', opts?: { amount?: number; tip?: number }): Promise<any> {
    return this.request(`/admin/pos/orders/${orderId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ gateway, ...(opts ?? {}) }),
    });
  }
  posRefund(orderId: number, body: { amount: number; gateway?: 'cash' | 'card'; reason?: string }): Promise<any> {
    return this.request(`/admin/pos/orders/${orderId}/refund`, { method: 'POST', body: JSON.stringify(body) });
  }
  posRedeem(orderId: number, body: { phone: string; points: number }): Promise<any> {
    return this.request(`/admin/pos/orders/${orderId}/redeem`, { method: 'POST', body: JSON.stringify(body) });
  }
  posServiceCharge(orderId: number, percent: number): Promise<any> {
    return this.request(`/admin/pos/orders/${orderId}/service-charge`, { method: 'POST', body: JSON.stringify({ percent }) });
  }

  // --- POS cash-drawer shift (Z-report) ---
  posShift(branchId?: number): Promise<any | null> {
    // A "no open shift" response is {data:null}; request() unwraps that to the
    // envelope (truthy), so normalise it back to a real shift object or null.
    return this.request<any>(`/admin/pos/shift/current${branchId ? `?branch_id=${branchId}` : ''}`).then((r) =>
      r && r.status ? r : null,
    );
  }
  posOpenShift(body: { opening_float?: number; branch_id?: number }): Promise<any> {
    return this.request('/admin/pos/shift/open', { method: 'POST', body: JSON.stringify(body) });
  }
  posCloseShift(shiftId: number, body: { counted_cash: number; note?: string }): Promise<any> {
    return this.request(`/admin/pos/shift/${shiftId}/close`, { method: 'POST', body: JSON.stringify(body) });
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
  // AI ileri (Faz 3) — advisor
  aiMenuInsights(branchId?: number): Promise<{ insights: string; products: number }> {
    return this.request('/admin/ai/menu-insights', {
      method: 'POST',
      body: JSON.stringify(branchId ? { branch_id: branchId } : {}),
    });
  }
  aiReviewSummary(): Promise<{ summary: string; reviews: number }> {
    return this.request('/admin/ai/review-summary', { method: 'POST' });
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
  superUsers(params: { q?: string; page?: number } = {}): Promise<{
    users: {
      id: number;
      name: string;
      email: string;
      role: string;
      role_label: string;
      is_active: boolean;
      tenant: string | null;
      tenant_slug: string | null;
      last_login_at: string | null;
      created_at: string | null;
    }[];
    total: number;
    page: number;
    per_page: number;
    last_page: number;
  }> {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.page) sp.set('page', String(params.page));
    const qs = sp.toString();
    return this.request(`/superadmin/users${qs ? `?${qs}` : ''}`);
  }
  superCreateUser(body: {
    name: string;
    email: string;
    password: string;
    role: string;
    tenant_id?: number | null;
  }): Promise<{ id: number; name: string; email: string; role: string; role_label: string; tenant: string | null }> {
    return this.request('/superadmin/users', { method: 'POST', body: JSON.stringify(body) });
  }
  superUpdateUser(
    id: number,
    body: { is_active?: boolean; password?: string; name?: string },
  ): Promise<{ id: number; is_active: boolean; role: string }> {
    return this.request(`/superadmin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  superDeleteUser(id: number): Promise<{ deleted: boolean }> {
    return this.request(`/superadmin/users/${id}`, { method: 'DELETE' });
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
  /** Live per-vertical demo deep-links for the QR-menu design gallery. */
  superMenuModelDemos(): Promise<{
    models: {
      vertical: 'restaurant' | 'hotel' | 'bar' | 'beach';
      demo: {
        slug: string;
        name: string;
        theme: string | null;
        area_name: string;
        area_type: string;
        table_code: string;
        qr_token: string;
      } | null;
    }[];
  }> {
    return this.request('/superadmin/menu-model-demos');
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
