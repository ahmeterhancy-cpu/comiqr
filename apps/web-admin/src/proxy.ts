import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * İstenen yolu kök layout'a taşır.
 *
 * `src/app/layout.tsx` hem paneli hem pazarlama sayfalarını kapsıyor ve
 * `<html lang>` değerini panel çerezinden alıyordu — Yunanca sayfa `lang="tr"`
 * yayınlıyor, hreflang ile çelişen bir sinyal veriyor ve ekran okuyucuya yanlış
 * dili bildiriyordu. Layout bileşeni kendi yolunu okuyamaz (Next bunu vermez),
 * bu yüzden yol burada bir istek başlığına yazılır ve layout `headers()` ile
 * okur.
 *
 * Next 16 `middleware` dosya adı kuralını kaldırdı: dosya `proxy.ts`,
 * export adı `proxy`.
 */
export const PATHNAME_HEADER = 'x-pathname';

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Statik varlıklar ve API yolları layout'tan geçmiyor.
  // Nokta için `[.]`: ters bölü kaçışı kabuk ve JS katmanlarında eriyip
  // deseni sessizce etkisiz bırakıyor.
  matcher: ['/((?!_next|api|.*[.].*).*)'],
};
