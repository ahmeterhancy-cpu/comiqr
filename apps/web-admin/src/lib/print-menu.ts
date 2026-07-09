/**
 * Yazdırılabilir menü — public menü verisinden (api.menu(slug)) baskıya hazır bir
 * A4 ÖNİZLEME penceresi açar. Kullanıcı önce menüyü görür, sonra üstteki araç
 * çubuğundan "Yazdır" veya "PDF olarak kaydet" seçer (ikisi de tarayıcının yazdırma
 * diyaloğunu açar; PDF için Hedef → "PDF olarak kaydet"). Sıfır bağımlılık.
 * Marka rengi/logo menü venue alanlarından gelir.
 */
export function printMenu(menu: any, opts: { columns?: 1 | 2 } = {}) {
  const venue = menu?.venue ?? {};
  const currency = venue.currency || 'TRY';
  const locale = venue.locale_default || 'tr';
  const brand = sanitizeColor(venue.brand_color) || '#14284a';
  const columns = opts.columns ?? 2;

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);

  const priceOf = (p: any): string => {
    const variants = Array.isArray(p.variants) ? p.variants : [];
    if (variants.length > 0) {
      return variants
        .map((v: any) => `${esc(v.name)} ${fmt(Number(p.price) + Number(v.price_delta ?? 0))}`)
        .join('  ·  ');
    }
    return fmt(Number(p.price ?? 0));
  };

  const categories = (menu?.categories ?? []).filter((c: any) => (c.products ?? []).length > 0);

  const sections = categories
    .map((c: any) => {
      const items = (c.products ?? [])
        .map((p: any) => {
          const variants = Array.isArray(p.variants) ? p.variants : [];
          const single = variants.length === 0;
          return `<div class="item">
            <div class="item-head">
              <span class="name">${esc(p.name)}${p.age_restricted ? ' <span class="age">18+</span>' : ''}</span>
              ${single ? `<span class="leader"></span><span class="price">${fmt(Number(p.price ?? 0))}</span>` : ''}
            </div>
            ${p.description ? `<div class="desc">${esc(p.description)}</div>` : ''}
            ${!single ? `<div class="variants">${esc(priceOf(p))}</div>` : ''}
          </div>`;
        })
        .join('');
      return `<section class="cat"><h2>${esc(c.name)}</h2>${items}</section>`;
    })
    .join('');

  const meta = [venue.address, venue.timing].filter(Boolean).map(esc).join('  ·  ');

  const html = `<!doctype html><html lang="${esc(locale)}"><head><meta charset="utf-8">
<title>${esc(venue.name || 'Menü')} — Menü</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #e7eaf0; }

  /* --- Araç çubuğu (yazdırmada gizlenir) --- */
  .toolbar {
    position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 12px 18px; background: rgba(231,234,240,.9); backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(0,0,0,.08); font: 14px/1.4 system-ui, sans-serif;
  }
  .toolbar .title { font-weight: 700; color: #1f2633; }
  .toolbar .hint { color: #6b7280; font-size: 12px; }
  .toolbar .spacer { flex: 1; }
  .btn { border: 0; cursor: pointer; border-radius: 10px; padding: 9px 16px; font-size: 14px; font-weight: 600; transition: filter .15s, transform .08s; }
  .btn:active { transform: translateY(1px); }
  .btn-primary { background: ${brand}; color: #fff; box-shadow: 0 2px 10px rgba(20,40,74,.28); }
  .btn-primary:hover { filter: brightness(1.15); }
  .btn-ghost { background: #fff; color: #1f2633; border: 1px solid rgba(0,0,0,.14); }
  .btn-ghost:hover { background: #f3f5f9; }

  /* --- A4 kağıt (önizleme) --- */
  .sheet {
    width: 210mm; max-width: calc(100% - 32px); margin: 22px auto 48px; background: #fff; color: #1a1a1a;
    padding: 16mm 15mm; box-shadow: 0 12px 48px rgba(10,20,40,.22); border-radius: 2px;
    font: 11pt/1.5 Georgia, "Times New Roman", serif;
  }
  .sheet header { text-align: center; border-bottom: 2px solid ${brand}; padding-bottom: 10px; margin-bottom: 18px; }
  .sheet header img { height: 56px; width: 56px; border-radius: 12px; margin: 0 auto 8px; display: block; object-fit: cover; }
  .sheet header h1 { color: ${brand}; font-size: 25pt; margin: 0 0 2px; letter-spacing: .3px; }
  .sheet header .sub { font-style: italic; color: #555; font-size: 11pt; margin: 0; }
  .sheet header .meta { color: #888; font-size: 9pt; margin-top: 6px; }
  .body { columns: ${columns}; column-gap: 14mm; }
  .cat { break-inside: avoid-column; margin: 0 0 15px; }
  .cat h2 { color: ${brand}; font-size: 13pt; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin: 0 0 9px; }
  .item { break-inside: avoid; margin-bottom: 10px; }
  .item-head { display: flex; align-items: baseline; }
  .name { font-weight: 700; }
  .age { font-size: 7pt; color: #b00; border: 1px solid #b00; border-radius: 3px; padding: 0 2px; vertical-align: middle; }
  .leader { flex: 1; border-bottom: 1px dotted #bbb; margin: 0 5px; transform: translateY(-3px); }
  .price { font-weight: 700; white-space: nowrap; }
  .desc { color: #666; font-size: 9.5pt; margin-top: 1px; }
  .variants { color: ${brand}; font-size: 9.5pt; font-weight: 600; margin-top: 2px; }
  .sheet footer { text-align: center; color: #aaa; font-size: 8pt; margin-top: 20px; border-top: 1px solid #eee; padding-top: 9px; }

  /* --- Gerçek yazdırma / PDF çıktısı --- */
  @page { size: A4; margin: 14mm; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .sheet { width: auto; max-width: none; margin: 0; padding: 0; box-shadow: none; border-radius: 0; }
  }
</style></head>
<body>
  <div class="toolbar">
    <span class="title">${esc(venue.name || 'Menü')}</span>
    <span class="hint">Baskıya hazır A4 · PDF için Hedef → &quot;PDF olarak kaydet&quot;</span>
    <span class="spacer"></span>
    <button class="btn btn-ghost" id="btnPrint" type="button">🖨️ Yazdır</button>
    <button class="btn btn-primary" id="btnPdf" type="button">📄 PDF olarak kaydet</button>
  </div>
  <div class="sheet">
    <header>
      ${venue.logo ? `<img src="${esc(venue.logo)}" alt="">` : ''}
      <h1>${esc(venue.name || 'Menü')}</h1>
      ${venue.sub_title ? `<p class="sub">${esc(venue.sub_title)}</p>` : ''}
      ${meta ? `<p class="meta">${meta}</p>` : ''}
    </header>
    <div class="body">${sections || '<p style="color:#999">Menüde ürün yok.</p>'}</div>
    <footer>${esc(venue.name || '')} · ComiQR ile hazırlandı</footer>
  </div>
  <script>
    var p = function () { window.focus(); window.print(); };
    document.getElementById('btnPrint').addEventListener('click', p);
    document.getElementById('btnPdf').addEventListener('click', p);
  </script>
</body></html>`;

  const w = window.open('', '_blank', 'width=920,height=1000');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Yalnız güvenli hex/rgb renklere izin ver (CSS injection'a karşı). */
function sanitizeColor(c: unknown): string | null {
  const s = String(c ?? '').trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(s) || /^rgb\([\d.,\s]+\)$/.test(s) ? s : null;
}
