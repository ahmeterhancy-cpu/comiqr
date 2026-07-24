import Constants from 'expo-constants';

/**
 * ComiQR API base. `EXPO_PUBLIC_API_URL` is the host root; the app appends `/v1`.
 * Dev (simulator): http://localhost:8000 — Android emulator: http://10.0.2.2:8000.
 * Physical device: http://<LAN-IP>:8000 (same wifi). Prod: the live API domain.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.apiUrl ||
  'http://localhost:8000';

export const API_BASE = `${API_URL.replace(/\/$/, '')}/v1`;

export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

/** How often the board / order screens re-poll the API (ms). */
export const POLL_MS = 5000;
