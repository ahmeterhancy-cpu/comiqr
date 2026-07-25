import * as Print from 'expo-print';
import { money } from './money';

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/**
 * Adisyon (order slip) yazdır — expo-print ile HTML üretip cihazın yazıcı
 * diyaloğunu açar (AirPrint / Android print service → bağlı termal yazıcı).
 * Ödeme/tahsilat DEĞİL; yalnız masadaki mevcut siparişin dökümü.
 */
export async function printAdisyon(opts: { order: any; tableCode: string; currency: string; venue?: string }): Promise<void> {
  const { order, tableCode, currency, venue = 'ComiQR' } = opts;
  const items = (order?.items ?? []).filter((i: any) => i.status !== 'cancelled');
  const rows = items
    .map((i: any) => {
      const mods = (i.modifiers ?? []).map((m: any) => m.name).join(', ');
      const line = money(i.line_total ?? Number(i.unit_price) * i.quantity, currency);
      return `<tr><td class="q">${i.quantity}×</td><td class="n">${esc(i.product_name ?? 'Ürün')}${mods ? `<br><small>${esc(mods)}</small>` : ''}</td><td class="p">${line}</td></tr>`;
    })
    .join('');
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box;font-family:-apple-system,Roboto,Arial,sans-serif}
    body{width:280px;margin:0 auto;padding:14px 10px;color:#000}
    h1{font-size:18px;text-align:center;margin:0 0 2px}
    .muted{color:#444;font-size:12px;text-align:center;margin:0 0 10px}
    table{width:100%;border-collapse:collapse;font-size:13px;border-top:1px dashed #000;border-bottom:1px dashed #000}
    td{padding:4px 0;vertical-align:top}.q{width:28px;font-weight:bold}.p{text-align:right;white-space:nowrap;padding-left:6px}
    small{color:#666}
    .row{display:flex;justify-content:space-between;font-size:13px;color:#333;margin-top:4px}
    .tot{display:flex;justify-content:space-between;font-weight:bold;font-size:17px;margin-top:8px;border-top:2px solid #000;padding-top:6px}
    .foot{text-align:center;color:#888;font-size:11px;margin-top:12px}
  </style></head><body>
    <h1>${esc(venue)}</h1>
    <p class="muted">${esc(tableCode)}${order?.id ? ` · Adisyon #${order.id}` : ''}</p>
    <table>${rows || '<tr><td>—</td></tr>'}</table>
    <div class="row"><span>Ara toplam</span><span>${money(order?.subtotal ?? 0, currency)}</span></div>
    ${Number(order?.tax_total) ? `<div class="row"><span>Servis</span><span>${money(order.tax_total, currency)}</span></div>` : ''}
    ${Number(order?.discount_total) ? `<div class="row"><span>İndirim</span><span>- ${money(order.discount_total, currency)}</span></div>` : ''}
    <div class="tot"><span>TOPLAM</span><span>${money(order?.grand_total ?? 0, currency)}</span></div>
    <p class="foot">Bu bir adisyon dökümüdür, mali belge değildir.</p>
  </body></html>`;
  await Print.printAsync({ html });
}
