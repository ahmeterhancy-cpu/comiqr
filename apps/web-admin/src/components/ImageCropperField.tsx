'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Upload + crop field for a logo or cover image. Shows a dashed dropzone; once an
 * image is picked it opens an adjustable cropper overlay (zoom slider + drag to
 * pan) framed to the target aspect ratio. On save it renders the visible crop to a
 * canvas and uploads that (so the stored image is exactly what the owner framed).
 */
export function ImageCropperField({
  kind,
  aspect,
  url,
  onChange,
  upload,
}: {
  kind: 'logo' | 'cover' | 'category';
  aspect: number; // width / height of the crop frame (1 = square, 3 = wide banner)
  url: string | null;
  onChange: (url: string | null) => void;
  upload: (file: File) => Promise<{ url: string }>;
}) {
  const [picked, setPicked] = useState<string | null>(null); // object URL being cropped
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function pick(file?: File | null) {
    setError(null);
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.type)) {
      setError('Yalnızca JPG, PNG veya WebP.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('Görsel çok büyük (maks. 50MB).');
      return;
    }
    setPicked(URL.createObjectURL(file));
  }

  async function onCropped(blob: Blob) {
    setBusy(true);
    setError(null);
    try {
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      const file = new File([blob], `${kind}.${ext}`, { type: blob.type });
      const res = await upload(file);
      onChange(res.url);
      setPicked(null);
    } catch {
      setError('Görsel yüklenemedi, tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {url ? (
        <div>
          <div className={`overflow-hidden rounded-xl border border-line bg-canvas ${aspect === 1 ? 'mx-auto aspect-square max-w-[220px]' : 'aspect-[3/1]'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={kind} className="h-full w-full object-cover" />
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-canvas">
              Değiştir
            </button>
            <button type="button" onClick={() => onChange(null)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50">
              Kaldır
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!dragOver) setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={`grid w-full place-items-center rounded-2xl border-2 border-dashed text-center transition ${
            dragOver ? 'border-brand-500 bg-brand-50 ring-4 ring-brand-100' : 'border-line bg-canvas hover:border-brand-400 hover:bg-brand-50/40'
          } ${aspect === 1 ? 'aspect-square max-h-[300px]' : 'aspect-[3/1]'}`}
        >
          <div className="px-6 py-8">
            <svg viewBox="0 0 24 24" className={`mx-auto h-8 w-8 transition ${dragOver ? 'text-brand-600' : 'text-muted'}`} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
            <div className="mt-2 text-sm font-semibold text-ink">{dragOver ? 'Bırakın, yükleyelim' : 'Yüklemek için tıklayın veya sürükleyip bırakın'}</div>
            <div className="mt-0.5 text-xs text-muted">JPG, JPEG, PNG, WebP · Maks. 50MB</div>
          </div>
        </button>
      )}

      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}

      {picked && (
        <Cropper
          src={picked}
          aspect={aspect}
          busy={busy}
          onCancel={() => {
            setPicked(null);
            URL.revokeObjectURL(picked);
          }}
          onSave={onCropped}
        />
      )}
    </div>
  );
}

/** Full-screen crop overlay: zoom slider + drag-to-pan, exports the framed region. */
function Cropper({
  src,
  aspect,
  busy,
  onCancel,
  onSave,
}: {
  src: string;
  aspect: number;
  busy: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}) {
  // Crop-frame display size (px). Wide for cover, square for logo.
  const FW = aspect === 1 ? 320 : 540;
  const FH = Math.round(FW / aspect);
  // Exported resolution.
  const OUT_W = aspect === 1 ? 512 : 1500;
  const OUT_H = Math.round(OUT_W / aspect);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  // "fill" = cover the whole frame (crop overflow); "fit" = show the whole image
  // inside the frame (letterboxed). Portrait posters usually want "fit".
  const [mode, setMode] = useState<'fill' | 'fit'>('fill');
  const coverScale = nat ? Math.max(FW / nat.w, FH / nat.h) : 1;
  const containScale = nat ? Math.min(FW / nat.w, FH / nat.h) : 1;
  const baseScale = mode === 'fill' ? coverScale : containScale;
  const [zoom, setZoom] = useState(1);
  const k = baseScale * zoom; // rendered px per source px
  const [pos, setPos] = useState({ x: 0, y: 0 }); // image top-left within the frame
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Keep the image within sensible bounds. Fill → no gaps; fit → image stays inside.
  const clamp = useCallback(
    (x: number, y: number, kk: number) => {
      if (!nat) return { x, y };
      const w = nat.w * kk;
      const h = nat.h * kk;
      const loX = Math.min(0, FW - w);
      const hiX = Math.max(0, FW - w);
      const loY = Math.min(0, FH - h);
      const hiY = Math.max(0, FH - h);
      return {
        x: Math.min(hiX, Math.max(loX, x)),
        y: Math.min(hiY, Math.max(loY, y)),
      };
    },
    [nat, FW, FH],
  );

  // Re-center (and reset zoom) whenever the image loads or the fit mode changes.
  useEffect(() => {
    if (!nat) return;
    const w = nat.w * baseScale;
    const h = nat.h * baseScale;
    setZoom(1);
    setPos({ x: (FW - w) / 2, y: (FH - h) / 2 });
  }, [nat, baseScale, FW, FH]);

  function onZoom(nextZoom: number) {
    if (!nat) return;
    const kNew = baseScale * nextZoom;
    // Keep the frame center fixed while zooming.
    const cx = (FW / 2 - pos.x) / k;
    const cy = (FH / 2 - pos.y) / k;
    const nx = FW / 2 - cx * kNew;
    const ny = FH / 2 - cy * kNew;
    setZoom(nextZoom);
    setPos(clamp(nx, ny, kNew));
  }

  function save() {
    if (!imgRef.current || !nat) return;
    const scale = OUT_W / FW; // display px → output px
    const canvas = document.createElement('canvas');
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    const type = aspect === 1 ? 'image/png' : 'image/jpeg';
    // Cover (wide) fills any "fit" letterbox with a blurred, zoomed copy of the same
    // image — so the banner is never boxed by empty bands. Logo (png) keeps gaps
    // transparent.
    if (aspect !== 1) {
      const bg = Math.max(OUT_W / nat.w, OUT_H / nat.h) * 1.15;
      const bw = nat.w * bg;
      const bh = nat.h * bg;
      ctx.filter = 'blur(28px)';
      ctx.drawImage(imgRef.current, (OUT_W - bw) / 2, (OUT_H - bh) / 2, bw, bh);
      ctx.filter = 'none';
    }
    // Reproduce the on-screen preview: draw the whole image at its framed
    // position/size (canvas clips overflow; gaps show the blurred bg). Fill + fit.
    ctx.drawImage(imgRef.current, pos.x * scale, pos.y * scale, nat.w * k * scale, nat.h * k * scale);
    canvas.toBlob((b) => b && onSave(b), type, 0.92);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/85">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex items-center gap-1.5 rounded-xl bg-white/95 px-2 py-1.5 shadow">
          <button
            type="button"
            onClick={() => onZoom(Math.max(1, Math.round((zoom - 0.2) * 100) / 100))}
            disabled={zoom <= 1}
            aria-label="Uzaklaştır"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink transition hover:bg-canvas disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M5 12h14" /></svg>
          </button>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => onZoom(Number(e.target.value))} className="w-36 accent-[#14b8a6]" />
          <button
            type="button"
            onClick={() => onZoom(Math.min(3, Math.round((zoom + 0.2) * 100) / 100))}
            disabled={zoom >= 3}
            aria-label="Yakınlaştır"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink transition hover:bg-canvas disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
        <div className="flex-1" />
        <button type="button" onClick={save} disabled={busy || !nat} aria-label="Kaydet" className="grid h-11 w-11 place-items-center rounded-xl bg-white text-ink shadow transition hover:bg-canvas disabled:opacity-50">
          {busy ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin text-brand-600" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 1 1-6.2-8.6" strokeLinecap="round" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
          )}
        </button>
        <button type="button" onClick={onCancel} aria-label="İptal" className="grid h-11 w-11 place-items-center rounded-xl bg-white text-ink shadow transition hover:bg-canvas">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Crop frame */}
      <div className="flex flex-1 items-center justify-center p-4">
        <div
          className="relative touch-none overflow-hidden bg-black/40 shadow-2xl"
          style={{ width: FW, height: FH, cursor: drag.current ? 'grabbing' : 'grab' }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const nx = drag.current.ox + (e.clientX - drag.current.x);
            const ny = drag.current.oy + (e.clientY - drag.current.y);
            setPos(clamp(nx, ny, k));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {aspect !== 1 && (
            // Blurred cover backdrop — fills "fit" letterbox so the banner never sits
            // in empty bands. eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" aria-hidden draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" style={{ filter: 'blur(22px)', transform: 'scale(1.2)' }} />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              width: nat ? nat.w * k : undefined,
              height: nat ? nat.h * k : undefined,
              maxWidth: 'none',
              userSelect: 'none',
            }}
          />
          {/* Rule-of-thirds guides */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/30" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/30" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/30" />
            <div className="absolute inset-0 ring-1 ring-white/70" />
          </div>
        </div>
      </div>

      {/* Fill / Fit mode */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl bg-white/95 p-1 shadow">
          {([['fill', 'Doldur'], ['fit', 'Sığdır']] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${mode === m ? 'bg-brand-500 text-white' : 'text-ink hover:bg-canvas'}`}
              style={mode === m ? { color: '#ffffff' } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="pb-6 pt-2 text-center text-xs text-white/70">
        <b>Doldur:</b> çerçeveyi tümüyle kaplar (taşan kısım kırpılır) · <b>Sığdır:</b> görselin tamamı sığar · kaydırarak konumlandırın
      </p>
    </div>
  );
}
