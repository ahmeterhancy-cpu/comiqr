'use client';

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { API_URL } from '@/lib/api';
import { getToken } from '@/lib/auth';

/**
 * A Laravel Echo client for the Reverb WebSocket server (M6/M10). Private
 * channels authorize via /v1/broadcasting/auth with the Sanctum bearer token.
 * Returns null on the server or when WS can't be created; callers keep polling
 * as a fallback, so a missing/offline Reverb server degrades gracefully.
 */
export function createEcho(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;
    return new Echo({
      broadcaster: 'reverb',
      key: process.env.NEXT_PUBLIC_REVERB_KEY ?? 'local-reverb-key',
      wsHost: process.env.NEXT_PUBLIC_REVERB_HOST ?? '127.0.0.1',
      wsPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080),
      wssPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080),
      forceTLS: (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? 'http') === 'https',
      enabledTransports: ['ws', 'wss'],
      authEndpoint: `${API_URL}/broadcasting/auth`,
      auth: { headers: { Authorization: `Bearer ${getToken() ?? ''}`, Accept: 'application/json' } },
    });
  } catch {
    return null;
  }
}
