import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { AuthSession, Tenant, WaiterUser } from '@/api/waiter';

const STORAGE_KEY = 'comiqr.waiter.auth';

interface AuthState {
  token: string | null;
  user: WaiterUser | null;
  tenant: Tenant | null;
  hydrated: boolean;
  currency: () => string;
  hydrate: () => Promise<void>;
  login: (data: AuthSession) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  tenant: null,
  hydrated: false,

  currency: () => get().tenant?.currency ?? 'TRY',

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({ token: data.token, user: data.user, tenant: data.tenant ?? null, hydrated: true });
        return;
      }
    } catch (err) {
      console.warn('[auth.hydrate] failed', err);
    }
    set({ hydrated: true });
  },

  login: async ({ token, user, tenant }) => {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ token, user, tenant }));
    set({ token, user, tenant });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    set({ token: null, user: null, tenant: null });
  },
}));
