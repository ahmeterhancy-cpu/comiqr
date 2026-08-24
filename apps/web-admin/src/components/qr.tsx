'use client';

import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** Quiet zone the QR spec requires around the symbol, in modules. */
const MARGIN = 4;

type Matrix = {
  count: number;
  side: number;
  isDark: (row: number, col: number) => boolean;
  /** One SVG path covering every dark module, already offset by the quiet zone. */
  path: string;
};

/**
 * Encode a string into a QR module matrix (Faz 4 — routing).
 *
 * Error correction 'M' survives normal print wear without making the symbol
 * needlessly dense, and type 0 lets the encoder pick the smallest version that
 * fits — a short table URL then stays comfortably scannable at sticker size.
 *
 * The matrix is handed back raw so callers can draw it twice over: as SVG for
 * the screen and straight onto a canvas for the PNG, with no markup round-trip
 * in between.
 */
export function useQrMatrix(text: string): Matrix {
  return useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();

    const count = qr.getModuleCount();
    let path = '';
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) path += `M${col + MARGIN} ${row + MARGIN}h1v1h-1z`;
      }
    }

    return {
      count,
      side: count + MARGIN * 2,
      isDark: (row: number, col: number) => qr.isDark(row, col),
      path,
    };
  }, [text]);
}

/** On-screen QR. Vector, so it stays crisp at any size the layout asks for. */
export function QrSvg({
  matrix,
  label,
  className = '',
}: {
  matrix: Matrix;
  label: string;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${matrix.side} ${matrix.side}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className={`bg-white ${className}`}
    >
      <path d={matrix.path} fill="#000000" />
    </svg>
  );
}

function download(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

/** Rasterise from the modules directly — nothing has to re-parse SVG markup. */
export function downloadQrPng(matrix: Matrix, filename: string): void {
  const scale = Math.max(1, Math.floor(1024 / matrix.side));
  const canvas = document.createElement('canvas');
  canvas.width = matrix.side * scale;
  canvas.height = matrix.side * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  for (let row = 0; row < matrix.count; row++) {
    for (let col = 0; col < matrix.count; col++) {
      if (matrix.isDark(row, col)) {
        ctx.fillRect((col + MARGIN) * scale, (row + MARGIN) * scale, scale, scale);
      }
    }
  }

  canvas.toBlob((blob) => blob && download(blob, filename), 'image/png');
}

/** Vector file for the print shop. */
export function downloadQrSvg(matrix: Matrix, filename: string): void {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${matrix.side} ${matrix.side}" shape-rendering="crispEdges">` +
    `<rect width="${matrix.side}" height="${matrix.side}" fill="#ffffff"/>` +
    `<path d="${matrix.path}" fill="#000000"/>` +
    `</svg>`;

  download(new Blob([svg], { type: 'image/svg+xml' }), filename);
}
