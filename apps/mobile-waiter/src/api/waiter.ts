import { apiRequest } from './client';

export interface WaiterUser {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
}
export interface Tenant {
  id: number;
  name: string;
  currency?: string;
}
export interface AuthSession {
  user: WaiterUser;
  tenant: Tenant | null;
  token: string;
}

export interface Table {
  table_id: number;
  code: string;
  area: string | null;
  area_id: number | null;
  state: 'occupied' | 'free';
  session_id: number | null;
  order_status: string | null;
  payment_status: string | null;
  total: string | number | null;
  opened_at: string | null;
  waiter_called: boolean;
  bill_requested: boolean;
}
export interface ServiceCall {
  session_id: number;
  table_code: string | null;
  waiter_called: boolean;
  bill_requested: boolean;
}
export interface ReadyItem {
  order_item_id: number;
  order_id: number;
  product: string | null;
  quantity: number;
}
export interface Notifications {
  service_calls: ServiceCall[];
  ready_items: ReadyItem[];
}

export interface OrderItemInput {
  product_id: number;
  variant_id?: number;
  quantity: number;
  modifiers?: number[];
}

/** ComiQR waiter + staff-POS surface. Mirrors the web waiter/POS clients. */
export const waiterApi = {
  login: (email: string, password: string) =>
    apiRequest<AuthSession>('/auth/login', {
      method: 'POST',
      body: { email, password, device_name: 'waiter-app' },
    }),

  // Waiter board (role:waiter + plan:waiter_app)
  tables: (token: string) => apiRequest<Table[]>('/waiter/tables', { token }),
  notifications: (token: string) => apiRequest<Notifications>('/waiter/notifications', { token }),
  served: (token: string, itemId: number) =>
    apiRequest(`/waiter/order-items/${itemId}/served`, { method: 'POST', token }),
  ack: (token: string, sessionId: number) =>
    apiRequest(`/waiter/sessions/${sessionId}/ack`, { method: 'POST', token }),

  // Menu reads (role:manager,cashier,waiter) — build a ticket
  products: (token: string) => apiRequest<any[]>('/admin/products', { token }),
  categories: (token: string) => apiRequest<any[]>('/admin/categories', { token }),

  // Order writes (role:waiter,cashier + plan:ordering) — send to kitchen
  openOrders: (token: string) => apiRequest<any[]>('/admin/pos/orders?scope=open', { token }),
  placeOrder: (token: string, tableId: number, items: OrderItemInput[]) =>
    apiRequest<any>('/admin/pos/orders', { method: 'POST', token, body: { table_id: tableId, items } }),
  addItems: (token: string, orderId: number, items: OrderItemInput[]) =>
    apiRequest<any>(`/admin/pos/orders/${orderId}/items`, { method: 'POST', token, body: { items } }),
  serviceCharge: (token: string, orderId: number, percent: number) =>
    apiRequest<any>(`/admin/pos/orders/${orderId}/service-charge`, { method: 'POST', token, body: { percent } }),
};
