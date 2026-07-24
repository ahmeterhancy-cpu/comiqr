'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Soft state shown when the menu fetch hit a transient failure (rate-limit 429,
 * 5xx, or a network blip) rather than a genuine 404. The builder preview polls
 * the public /menu endpoint with `no-store`, so a burst of edits can briefly trip
 * the rate limit — this recovers automatically instead of flashing a hard "404".
 *
 * Auto-retry count lives in the URL (`?r=N`) so a full reload can't loop forever:
 * after MAX_AUTO attempts it stops and offers a manual retry.
 */
const MAX_AUTO = 3;

export function MenuUnavailable({ attempt }: { attempt: number }) {
  const t = useTranslations('unavailable');
  const [retrying, setRetrying] = useState(attempt < MAX_AUTO);

  useEffect(() => {
    if (attempt >= MAX_AUTO) return;
    const id = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('r', String(attempt + 1));
      window.location.replace(url.toString());
    }, 2000);
    return () => clearTimeout(id);
  }, [attempt]);

  function manualRetry() {
    setRetrying(true);
    const url = new URL(window.location.href);
    url.searchParams.set('r', '0'); // reset the auto-retry budget
    window.location.replace(url.toString());
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        textAlign: 'center',
        color: '#334155',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '3px solid #cbd5e1',
          borderTopColor: '#0f766e',
          animation: retrying ? 'menu-unavailable-spin 0.8s linear infinite' : 'none',
        }}
      />
      <div style={{ fontSize: 16, fontWeight: 600 }}>
        {retrying ? t('loading') : t('failed')}
      </div>
      <div style={{ fontSize: 14, color: '#64748b', maxWidth: 320 }}>
        {retrying ? t('retryingBody') : t('failedBody')}
      </div>
      {!retrying && (
        <button
          type="button"
          onClick={manualRetry}
          style={{
            marginTop: 4,
            padding: '10px 20px',
            borderRadius: 10,
            border: 'none',
            background: '#0f766e',
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('retry')}
        </button>
      )}
      <style>{`@keyframes menu-unavailable-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
