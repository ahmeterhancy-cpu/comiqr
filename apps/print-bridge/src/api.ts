import type { PrintJob } from './types.js';

/**
 * Köprünün ComiQR ile konuşan yüzü. Kimlik doğrulama Sanctum jetonuyla;
 * jeton düşerse (401) bir kez yeniden giriş yapılır — mutfak gecesinin
 * ortasında köprünün susmaması için.
 */
export class ComiqrApi {
  private token: string | null = null;

  constructor(
    private baseUrl: string,
    private email: string,
    private password: string,
    private deviceName = 'print-bridge',
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async login(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password, device_name: this.deviceName }),
    });

    if (!res.ok) {
      throw new Error(`Giriş başarısız (${res.status}). E-posta/parola ve rolü (mutfak yetkisi) kontrol edin.`);
    }

    const body = (await res.json()) as { data?: { token?: string } };
    if (!body.data?.token) {
      throw new Error('Giriş yanıtında jeton yok.');
    }

    this.token = body.data.token;
  }

  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    if (!this.token) await this.login();

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Accept: 'application/json',
        Authorization: `Bearer ${this.token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });

    if (res.status === 401 && retry) {
      this.token = null;
      return this.request<T>(path, init, false);
    }

    if (!res.ok) {
      throw new Error(`${path} → ${res.status}`);
    }

    return (await res.json()) as T;
  }

  /** Sırası gelmiş fişler; en eski önce. */
  async pending(printerId?: number): Promise<PrintJob[]> {
    const qs = printerId ? `?printer_id=${printerId}` : '';
    const body = await this.request<{ data: PrintJob[] }>(`/admin/print-jobs/pending${qs}`);

    return body.data ?? [];
  }

  /** Sonucu bildir: basıldıysa kuyruktan düşer, basılmadıysa hata metniyle durur. */
  async ack(jobId: number, ok: boolean, error?: string): Promise<void> {
    await this.request(`/admin/print-jobs/${jobId}/ack`, {
      method: 'POST',
      body: JSON.stringify({ ok, error: error?.slice(0, 500) }),
    });
  }
}
