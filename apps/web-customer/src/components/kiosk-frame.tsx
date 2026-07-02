'use client';

import { OrderableMenu } from '@/components/orderable-menu';
import type { Menu } from '@comiqr/shared-types';

/**
 * Self-service kiosk (M16) — a stationary tablet at the venue. Reuses the full
 * ordering flow (OrderableMenu); adds a kiosk top bar with a "new order" reset
 * that reloads to a clean cart for the next guest.
 */
export function KioskFrame({ menu, qrToken, tableCode }: { menu: Menu; qrToken: string; tableCode?: string }) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-brand-600 px-6 py-3 text-white">
        <span className="font-display text-lg font-semibold" style={{ color: '#ffffff' }}>
          Self-Servis Sipariş
        </span>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
          style={{ color: '#ffffff' }}
        >
          Yeni Sipariş
        </button>
      </div>
      <OrderableMenu menu={menu} qrToken={qrToken} tableCode={tableCode} />
    </div>
  );
}
