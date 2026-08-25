import assert from 'node:assert/strict';
import iconv from 'iconv-lite';
import test from 'node:test';
import { renderTicket } from './escpos.js';
import type { TicketPayload } from './types.js';

const ticket: TicketPayload = {
  type: 'order',
  printer: { id: 1, name: 'Mutfak', kind: 'kitchen' },
  order: { id: 42, source: 'pos', table: 'M2', placed_at: '2026-08-03T18:30:00+03:00', note: 'Acele' },
  lines: [
    { name: 'Adana Kebap', quantity: 2, modifiers: ['Acılı'], note: 'az pişmiş' },
    { name: 'Ayran', quantity: 1, modifiers: [] },
  ],
  copies: 1,
};

test('fiş ESC/POS ile başlar ve kesme komutuyla biter', () => {
  const bytes = renderTicket(ticket);

  // ESC @ (init) + ESC t (karakter tablosu)
  assert.deepEqual([...bytes.subarray(0, 2)], [0x1b, 0x40]);
  assert.deepEqual([...bytes.subarray(2, 4)], [0x1b, 0x74]);
  // GS V — kesme
  assert.ok(bytes.includes(Buffer.from([0x1d, 0x56])), 'kesme komutu yok');
});

test('masa kodu, kalemler, ek seçenekler ve not fişte yer alır', () => {
  const text = iconv.decode(renderTicket(ticket), 'cp857');

  assert.match(text, /M2/);
  assert.match(text, /2x Adana Kebap/);
  assert.match(text, /\+ Acılı/);
  assert.match(text, /! az pişmiş/);
  assert.match(text, /1x Ayran/);
  assert.match(text, /Not: Acele/);
  assert.match(text, /Fis No: 42/);
});

test('kopya sayısı kadar fiş art arda üretilir', () => {
  const one = renderTicket({ ...ticket, copies: 1 });
  const three = renderTicket({ ...ticket, copies: 3 });

  assert.equal(three.length, one.length * 3);
});

test('ascii kodlaması Türkçe harfleri sadeleştirir', () => {
  const text = renderTicket(ticket, { codepageIconv: 'ascii' }).toString('ascii');

  assert.match(text, /\+ Acili/);
  assert.match(text, /! az pismis/);
  assert.doesNotMatch(text, /ı|ş|ç/);
});

test('genişlik ayarı ayraç satırını belirler', () => {
  const narrow = iconv.decode(renderTicket(ticket, { width: 32 }), 'cp857');

  assert.match(narrow, /^-{32}$/m);
  assert.doesNotMatch(narrow, /^-{42}$/m);
});
