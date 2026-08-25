import iconv from 'iconv-lite';
import type { TicketPayload } from './types.js';

/**
 * Fiş içeriğini ESC/POS baytlarına çevirir.
 *
 * Sunucu fişi VERİ olarak kuyruğa koyar; kâğıt genişliğine, karakter tablosuna
 * ve kesme biçimine burada karar verilir. Böylece aynı iş 58 mm bir bar
 * yazıcısında da 80 mm mutfak yazıcısında da doğru basılır.
 *
 * Türkçe karakterler için varsayılan kod sayfası PC857'dir (Epson'da `ESC t 13`).
 * Farklı marka/model farklı numara isteyebildiği için ikisi de yapılandırmadan
 * gelir; hiç desteklemeyen bir yazıcıda `ascii` seçeneği harfleri sadeleştirir.
 */

const ESC = 0x1b;
const GS = 0x1d;

export type RenderOptions = {
  /** Satır başına karakter: 80 mm ≈ 42-48, 58 mm ≈ 32. */
  width: number;
  /** ESC t için karakter tablosu numarası (PC857 = 13). */
  codepageEscpos: number;
  /** iconv-lite kodlaması (cp857 · cp850 · ascii). */
  codepageIconv: string;
  /** Kesme: tam (0) veya kısmi (1). */
  partialCut: boolean;
};

export const DEFAULT_RENDER: RenderOptions = {
  width: 42,
  codepageEscpos: 13,
  codepageIconv: 'cp857',
  partialCut: true,
};

const TITLES: Record<TicketPayload['type'], string> = {
  order: 'SIPARIS',
  addition: 'EK SIPARIS',
  bill: 'ADISYON',
  test: 'TEST FISI',
};

/** Kod sayfası hiç tutmazsa okunur bir çıktı kalsın diye Türkçe harfleri sadeleştir. */
const ASCII_MAP: Record<string, string> = {
  ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I',
  ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U',
};

function toAscii(text: string): string {
  return text.replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => ASCII_MAP[c] ?? c);
}

class Builder {
  private parts: Buffer[] = [];

  constructor(private opts: RenderOptions) {}

  raw(...bytes: number[]): this {
    this.parts.push(Buffer.from(bytes));

    return this;
  }

  text(value: string): this {
    const encoding = this.opts.codepageIconv;
    const prepared = encoding === 'ascii' ? toAscii(value) : value;
    this.parts.push(
      iconv.encodingExists(encoding) ? iconv.encode(prepared, encoding) : Buffer.from(toAscii(prepared), 'ascii'),
    );

    return this;
  }

  line(value = ''): this {
    return this.text(value).raw(0x0a);
  }

  /** Sol ve sağa yaslı iki parça — araya boşluk doldurur (ör. ürün / adet). */
  columns(left: string, right: string): this {
    const room = Math.max(1, this.opts.width - left.length - right.length);

    return this.line(left + ' '.repeat(room) + right);
  }

  rule(char = '-'): this {
    return this.line(char.repeat(this.opts.width));
  }

  align(mode: 'left' | 'center' | 'right'): this {
    return this.raw(ESC, 0x61, mode === 'center' ? 1 : mode === 'right' ? 2 : 0);
  }

  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  /** GS ! — genişlik ve yükseklik çarpanı (1 veya 2). */
  size(w: 1 | 2, h: 1 | 2): this {
    return this.raw(GS, 0x21, ((w - 1) << 4) | (h - 1));
  }

  feedAndCut(): this {
    return this.raw(ESC, 0x64, 4).raw(GS, 0x56, this.opts.partialCut ? 1 : 0);
  }

  build(): Buffer {
    return Buffer.concat(this.parts);
  }
}

function clockOf(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);

  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

/** Fişi baytlara çevirir. `copies` birden fazlaysa aynı fiş art arda tekrarlanır. */
export function renderTicket(payload: TicketPayload, options: Partial<RenderOptions> = {}): Buffer {
  const opts: RenderOptions = { ...DEFAULT_RENDER, ...options };
  const copies = Math.max(1, Number(payload.copies ?? 1));
  const one = renderOnce(payload, opts);

  return Buffer.concat(Array.from({ length: copies }, () => one));
}

function renderOnce(payload: TicketPayload, opts: RenderOptions): Buffer {
  const b = new Builder(opts);

  b.raw(ESC, 0x40); // init
  b.raw(ESC, 0x74, opts.codepageEscpos); // karakter tablosu

  b.align('center').bold(true).size(1, 2);
  b.line(TITLES[payload.type] ?? 'FIS');
  b.size(1, 1).bold(false);

  b.line(payload.printer?.name ?? '');

  const table = payload.order?.table;
  if (table) {
    b.size(2, 2).bold(true).line(table).size(1, 1).bold(false);
  }

  b.align('left').rule();

  if (payload.order?.id) {
    b.columns(`Fis No: ${payload.order.id}`, clockOf(payload.order.placed_at));
  }
  if (payload.order?.source) {
    b.line(`Kanal: ${payload.order.source}`);
  }

  b.rule();

  for (const item of payload.lines ?? []) {
    b.bold(true).line(`${item.quantity}x ${item.name ?? '-'}`).bold(false);

    for (const modifier of item.modifiers ?? []) {
      b.line(`   + ${modifier}`);
    }
    if (item.note) {
      b.line(`   ! ${item.note}`);
    }
  }

  b.rule();

  if (payload.order?.note) {
    b.line(`Not: ${payload.order.note}`);
    b.rule();
  }

  b.align('center').line('ComiQR');
  b.feedAndCut();

  return b.build();
}
