'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { QrSvg, downloadQrPng, downloadQrSvg, useQrMatrix } from '@/components/qr';
import { Button, Card } from '@/components/ui';

const CUSTOMER_URL = process.env.NEXT_PUBLIC_CUSTOMER_URL ?? 'http://localhost:3010';

/**
 * The venue's own public address (Faz 4 — routing). This is the standalone link
 * an owner puts in an Instagram bio, a Google listing or a table-top poster: it
 * needs no table and no QR scan, so it is shown as plain copyable text next to a
 * printable code rather than buried in the theme previews.
 */
export function PublicLinkCard({ slug, venueName }: { slug: string; venueName?: string }) {
  const t = useTranslations('publicLink');
  const q = useTranslations('qr');
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const url = `${CUSTOMER_URL}/${slug}`;
  const matrix = useQrMatrix(url);
  const fileBase = `comiqr-${slug}`;

  /**
   * Copy with a fallback. The async clipboard API is refused outside a secure
   * context — an owner opening the panel over plain http on a LAN address hits
   * exactly that — so a failure falls back to the old execCommand path, and if
   * that fails too the address is selected so it can be copied by hand. A dead
   * button with no explanation is the one outcome worth avoiding.
   */
  function copy() {
    const done = (ok: boolean) => {
      setCopied(ok);
      setManual(!ok);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setCopied(false);
        setManual(false);
      }, 2500);
    };

    const legacyCopy = () => {
      try {
        const field = document.createElement("textarea");
        field.value = url;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(field);
        done(ok);
      } catch {
        done(false);
      }
    };

    if (!navigator.clipboard?.writeText) {
      legacyCopy();
      return;
    }

    navigator.clipboard.writeText(url).then(() => done(true)).catch(legacyCopy);
  }

  return (
    <Card className="mb-5">
      <h3 className="text-sm font-semibold text-ink">{t('title')}</h3>
      <p className="mt-1 text-xs text-muted">{t('hint')}</p>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2.5">
            <span className="min-w-0 flex-1 select-all break-all font-mono text-sm text-ink">{url}</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={copy}>
              {copied ? t('copied') : t('copy')}
            </Button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-canvas"
            >
              {t('open')}
            </a>
          </div>

          {manual && <p className="mt-2 text-xs font-medium text-amber-700">{t('copyManual')}</p>}

          <p className="mt-3 text-xs text-muted">{t('tableHint')}</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <QrSvg
            matrix={matrix}
            label={t('qrAlt', { venue: venueName ?? slug })}
            className="h-40 w-40 rounded-xl border border-line p-1"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => downloadQrPng(matrix, `${fileBase}-qr.png`)}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              {q('downloadPng')}
            </button>
            <span className="text-xs text-muted">·</span>
            <button
              type="button"
              onClick={() => downloadQrSvg(matrix, `${fileBase}-qr.svg`)}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              {q('downloadSvg')}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
