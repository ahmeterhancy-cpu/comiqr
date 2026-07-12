'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MeResult } from '@comiqr/shared-types';
import { ApiClient } from '@comiqr/shared-types/client';
import { API_URL } from './api';
import { clearSession, getToken } from './auth';

/**
 * Auth-guarded API client for panel pages. Redirects to the login page when
 * there is no token, and loads the current user/tenant once. Pass `loginPath`
 * to send unauthenticated users to a context-specific login (e.g. the POS
 * terminal uses '/pos/login' instead of the panel '/login').
 */
export function useApi(loginPath = '/login') {
  const router = useRouter();
  const [me, setMe] = useState<MeResult | null>(null);
  const [ready, setReady] = useState(false);
  const clientRef = useRef<ApiClient | null>(null);

  if (!clientRef.current) {
    clientRef.current = new ApiClient({ baseUrl: API_URL, token: getToken() });
  }

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace(loginPath);
      return;
    }
    clientRef.current!.withToken(token);
    clientRef.current!
      .me()
      .then((m) => {
        setMe(m);
        setReady(true);
      })
      .catch(() => {
        clearSession();
        router.replace(loginPath);
      });
  }, [router, loginPath]);

  return { api: clientRef.current!, me, ready };
}
