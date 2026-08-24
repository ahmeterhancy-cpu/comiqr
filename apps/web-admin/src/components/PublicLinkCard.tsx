'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import qrcode from 'qrcode-generator';
import { Button, Card } from '@/components/ui';

const CUSTOMER_URL = process.env.NEXT_PUBLIC_CUSTOMER_URL ?? 'http://localhost:3010';

/** Quiet zone the QR spec requires around the symbol, in modules. */
const MARGIN = 4;

/**
 * The venue's own public address (Faz 4 — routing). This is the standalone link
 * an owner puts in an Instagram bio, a Google listing or a table-top poster: it
 * needs no table and no QR scan, so it is shown as plain copyable text next to a
 * printable code rather than buried in the theme previews.
 *
 * The QR is drawn from the module matrix twice over: as inline SVG for the
 * screen, and onto a canvas for the PNG download — so nothing has to re-parse
 * markup, and the print shop can have the vector file as well.
 */
export function PublicLinkCard({ slug, venueName }: { slug: string; venueName?: string }) {
  const t = useTranslations('publicLink');
  const c = useTranslations('common');
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const url = `${CUSTOMER_URL}/${slug}`;

  // Type 0 = pick the smallest symbol that fits; 'M' survives normal print wear.
  const { count, isDark, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();

    const n = qr.getModuleCount();
    let d = '';
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(row, col)) d += `M${col + MARGIN} ${row + MARGIN}h1v1h-1z`;
      }
    }

    return { count: n, isDark: (r: number, col: number) => qr.isDark(r, col), path: d };
  }, [url]);

  const side = count + MARGIN * 2;
  const fileBase = `comiqr-${slug}`;

  function copy() {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  }

  function download(blob: Blob, filename: string) {
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
  }

  /** Rasterise straight from the modules — no SVG round-trip to go wrong. */
  function downloadPng() {
    const scale = Math.max(1, Math.floor(1024 / side));
    const canvas = document.createElement('canvas');
    canvas.width = side * scale;
    canvas.height = side * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (isDark(row, col)) {
          ctx.fillRect((col + MARGIN) * scale, (row + MARGIN) * scale, scale, scale);
        }
      }
    }

    canvas.toBlob((blob) => blob && download(blob, `${fileBase}-qr.png`), 'image/png');
  }

  function downloadSvg() {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges">` +
      `<rect width="${side}" height="${side}" fill="#ffffff"/>` +
      `<path d="${path}" fill="#000000"/>` +
      `</svg>`;

    download(new Blob([svg], { type: 'image/svg+xml' }), `${fileBase}-qr.svg`);
  }

  return (
    <Card className="mb-5">
      <h3 className="text-sm font-semibold text-ink">{t('title')}</h3>
      <p className="mt-1 text-xs text-muted">{t('hint')}</p>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2.5">
            <span className="min-w-0 flex-1 break-all font-mono text-sm text-ink">{url}</span>
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

          <p className="mt-3 text-xs text-muted">{t('tableHint')}</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <svg
            viewBox={`0 0 ${side} ${side}`}
            shapeRendering="crispEdges"
            role="img"
            aria-label={t('qrAlt', { venue: venueName ?? slug })}
            className="h-40 w-40 rounded-xl border border-line bg-white p-1"
          >
            <path d={path} fill="#000000" />
          </svg>

          <div className="flex gap-2">
            <button type="button" onClick={downloadPng} className="text-xs font-semibold text-brand-600 hover:underline">
              {t('downloadPng')}
            </button>
            <span className="text-xs text-muted">·</span>
            <button type="button" onClick={downloadSvg} className="text-xs font-semibold text-brand-600 hover:underline">
              {t('downloadSvg')}
            </button>
          </div>
          <span className="text-[11px] text-muted">{c('print')}</span>
        </div>
      </div>
    </Card>
  );
}
