'use client';

import { ApiClient } from '@comiqr/shared-types/client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/v1';
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'ComiQR';

export function createApi(token?: string | null): ApiClient {
  return new ApiClient({ baseUrl: API_URL, token });
}
