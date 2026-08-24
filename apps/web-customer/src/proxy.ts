import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Legacy URL compatibility for venues migrating off the old comiqr.com.
 *
 * The previous system addressed a venue as /{city}/{slug}
 * (comiqr.com/girne/jashan-indian-restaurant). The new one drops the city and
 * serves the venue at the bare slug, so every old link — printed material,
 * Google results, anything a guest bookmarked — is forwarded here with a 301.
 * A permanent redirect is deliberate: it tells search engines to transfer the
 * old address's standing to the new one instead of treating it as a duplicate.
 *
 * Only the app's own top-level paths are excluded. Anything else two segments
 * deep can only be an old city URL, so no list of cities has to be maintained —
 * a venue in a town we never enumerated still resolves.
 */
const APP_SEGMENTS = new Set([
  'v',
  'm',
  'order',
  'order-result',
  'board',
  'kiosk',
  'discover',
  'api',
  '_next',
  '_vercel',
]);

export function proxy(request: NextRequest) {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);

  const isLegacyCityUrl =
    segments.length === 2 && !APP_SEGMENTS.has(segments[0]) && !segments[1].includes('.');

  if (isLegacyCityUrl) {
    const url = request.nextUrl.clone();
    url.pathname = `/${segments[1]}`; // city dropped, query string preserved

    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  // Static assets and API routes never need rewriting.
  matcher: ['/((?!_next|api|.*[.].*).*)'],
};
