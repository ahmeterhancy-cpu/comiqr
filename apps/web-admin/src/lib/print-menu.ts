/**
 * Yazdırılabilir menü — public menü verisinden (api.menu(slug)) baskıya hazır A4
 * bir HTML açar ve window.print() çağırır (tarayıcının "PDF olarak kaydet"i).
 * Sıfır bağımlılık; pos-kit.tsx printReceipt() ile aynı desen (yeni pencere +
 * inline HTML + @page print-CSS). Marka rengi/logo menü venue alanlarından gelir.
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
<title>${esc(venue.name || 'Menü')}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.5 "Georgia", "Times New Roman", serif; color: #1a1a1a; margin: 0; }
  header { text-align: center; border-bottom: 2px solid ${brand}; padding-bottom: 10px; margin-bottom: 16px; }
  header img { max-height: 54px; margin: 0 auto 8px; display: block; }
  header h1 { color: ${brand}; font-size: 24pt; margin: 0 0 2px; letter-spacing: .3px; }
  header .sub { font-style: italic; color: #555; font-size: 11pt; margin: 0; }
  header .meta { color: #777; font-size: 9pt; margin-top: 6px; }
  .body { columns: ${columns}; column-gap: 14mm; }
  .cat { break-inside: avoid-column; margin: 0 0 14px; }
  .cat h2 { color: ${brand}; font-size: 13pt; text-transform: uppercase; letter-spacing: 1px;
            border-bottom: 1px solid #ddd; padding-bottom: 3px; margin: 0 0 8px; }
  .item { break-inside: avoid; margin-bottom: 9px; }
  .item-head { display: flex; align-items: baseline; }
  .name { font-weight: 700; }
  .age { font-size: 7pt; color: #b00; border: 1px solid #b00; border-radius: 3px; padding: 0 2px; vertical-align: middle; }
  .leader { flex: 1; border-bottom: 1px dotted #bbb; margin: 0 4px; transform: translateY(-3px); }
  .price { font-weight: 700; white-space: nowrap; }
  .desc { color: #666; font-size: 9.5pt; margin-top: 1px; }
  .variants { color: ${brand}; font-size: 9.5pt; font-weight: 600; margin-top: 2px; }
  footer { text-align: center; color: #999; font-size: 8pt; margin-top: 18px; border-top: 1px solid #eee; padding-top: 8px; }
</style></head>
<body>
  <header>
    ${venue.logo ? `<img src="${esc(venue.logo)}" alt="">` : ''}
    <h1>${esc(venue.name || 'Menü')}</h1>
    ${venue.sub_title ? `<p class="sub">${esc(venue.sub_title)}</p>` : ''}
    ${meta ? `<p class="meta">${meta}</p>` : ''}
  </header>
  <div class="body">${sections || '<p style="color:#999">Menüde ürün yok.</p>'}</div>
  <footer>${esc(venue.name || '')} · ComiQR ile hazırlandı</footer>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close()},400)}</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=1000');
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
