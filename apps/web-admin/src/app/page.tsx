'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { isAuthenticated } from '@/lib/auth';

/* Orange brand scope — overrides the admin's indigo tokens for the public site only. */
const ORANGE: CSSProperties = {
  ['--color-brand-50' as string]: '#fff3ec',
  ['--color-brand-100' as string]: '#ffe1ce',
  ['--color-brand-500' as string]: '#ea5b1a',
  ['--color-brand-600' as string]: '#c9490f',
  ['--color-brand-700' as string]: '#9e3a0c',
};

function Icon({ d, fill = false }: { d: string; fill?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const GUEST_FEATURES = [
  { t: 'Premium QR menü', d: 'Fotoğraflı kartlar, kategori kaydırma, arama ve 3 hazır tema. Uygulama indirmeden.', d1: 'M4 3h16v18H4zM8 8h8M8 12h8M8 16h4' },
  { t: 'Canlı çalışma saatleri', d: 'Saate göre otomatik Açık/Kapalı; dokununca haftalık program açılır.', d1: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2' },
  { t: 'Garson çağır & hesap iste', d: 'Misafir masasını seçer; çağrı anında personel ekranına düşer.', d1: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0' },
  { t: 'Sepet & sipariş', d: 'Masada, gel-al veya teslimat. Varyant ve ekstra seçenekli sepet.', d1: 'M2 3h3l2.2 12.3a1.5 1.5 0 001.5 1.2h8.6a1.5 1.5 0 001.5-1.2L22 7H6.2M9 20a1 1 0 100 .01M19 20a1 1 0 100 .01' },
  { t: 'Detay & malzeme reçetesi', d: 'Alerjen, kalori, protein/karb/yağ ve “kaç gram et, kaç gram un” malzemeleri.', d1: 'M12 21s-6-5.3-6-10a6 6 0 1112 0c0 4.7-6 10-6 10zM12 11a2 2 0 100-.01' },
  { t: '5 dilde arayüz', d: 'Türkçe, İngilizce, Almanca, Rusça, Arapça — turist yoğun bölgelere birebir.', d1: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.6 2.5 15 0 18M12 3c-2.5 2.6-2.5 15 0 18' },
  { t: 'AI menü asistanı', d: '“Az kalorili vejetaryen ne önerirsin?” — asistan menüden yanıtlar.', d1: 'M12 3a9 9 0 109 9 4.5 4.5 0 01-5-6 4.5 4.5 0 01-4-3z' },
  { t: 'İletişim, sosyal & WiFi', d: 'Instagram, WhatsApp, harita ve misafir WiFi — başlıkta, tek dokunuşla.', d1: 'M3 5h18v14H3zM3 7l9 6 9-6' },
  { t: 'Değerlendirme & itibar', d: 'Sipariş sonrası yıldız ve yorum; ortalama puan menüde ve panelde.', d1: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z' },
];

const OPS_FEATURES = [
  { t: 'Sipariş & mutfak ekranı (KDS)', d: 'Gelen siparişler mutfak ekranına canlı düşer, durumları takip edilir.' },
  { t: 'Personel POS & garson app', d: 'Kasa, kapıda nakit/kart, masa yönetimi ve servis çağrıları.' },
  { t: 'Online ödeme (Tiko)', d: '3D Secure, kart saklama ve güvenli tahsilat — kapıda ya da online.' },
  { t: 'Stok & 86 listesi', d: 'Tükenen ürünü tek tıkla menüden gizle, malzeme maliyetini gör.' },
  { t: 'Kampanya & kupon', d: 'İndirim kodları, kampanyalar ve puan/cashback ile sadakat.' },
  { t: 'White-label', d: 'Kendi markanız, renginiz ve alan adınız — “Powered by” gizli.' },
];

const VERTICALS = [
  { e: '🍽️', t: 'Restoran & Kafe', d: 'Masa siparişi, gel-al ve teslimat; garson çağırma ve hesap akışı.' },
  { e: '🏨', t: 'Otel', d: 'Oda servisi ve odaya yansıtma (folyo); çıkışta tek hesap.' },
  { e: '🍹', t: 'Bar & Pub', d: 'Adisyon akışı, 18+ işaret ve otomatik Happy Hour indirimi.' },
  { e: '🏖️', t: 'Plaj Kulübü', d: 'Şezlong servisi ve şezlonga yansıtma; sahilden sipariş.' },
];

const PLANS = [
  { name: 'Başlangıç', price: '₺0', per: '/ay', desc: 'Dijital QR menüye geçen küçük işletmeler için.', cta: 'Ücretsiz Başla', feat: false,
    items: ['QR menü + 3 tema', 'Çalışma saati, WiFi, iletişim', 'Besin değeri & alerjen', '5 dil'] },
  { name: 'Pro', price: '₺29', per: '/ay', desc: 'Masadan sipariş ve servis akışı isteyenler için.', cta: '14 Gün Ücretsiz', feat: true,
    items: ['Başlangıç’taki her şey', 'Sepet, sipariş & KDS', 'Garson çağır & hesap iste', 'Online ödeme & AI asistan'] },
  { name: 'Business', price: '₺79', per: '/ay', desc: 'Otel, plaj ve çok şubeli işletmeler için.', cta: '14 Gün Ücretsiz', feat: false,
    items: ['Pro’daki her şey', 'Otel & plaj (folyo)', 'Çok şube & sadakat', 'Gelişmiş raporlar'] },
  { name: 'Kurumsal', price: 'Özel', per: '', desc: 'Markalı deneyim ve öncelikli destek.', cta: 'İletişime Geç', feat: false,
    items: ['Business’taki her şey', 'White-label & alan adı', 'AI içgörüler', 'Öncelikli destek & SLA'] },
];

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setAuthed(isAuthenticated());
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const primaryHref = authed ? '/dashboard' : '/register';
  const primaryLabel = authed ? 'Panele Git' : 'Ücretsiz Başla';

  return (
    <div style={ORANGE} className="min-h-screen bg-canvas text-ink">
      {/* NAV */}
      <nav className={`sticky top-0 z-50 backdrop-blur transition ${scrolled ? 'border-b border-line bg-canvas/85' : 'bg-canvas/60'}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 font-extrabold text-white shadow-sm">Q</span>
            <span className="text-lg font-extrabold tracking-tight">ComiQR</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#ozellikler" className="text-sm font-semibold text-muted transition hover:text-ink">Özellikler</a>
            <a href="#turler" className="text-sm font-semibold text-muted transition hover:text-ink">İşletme Türleri</a>
            <a href="#nasil" className="text-sm font-semibold text-muted transition hover:text-ink">Nasıl Çalışır</a>
            <a href="#fiyatlar" className="text-sm font-semibold text-muted transition hover:text-ink">Fiyatlar</a>
          </div>
          <div className="flex items-center gap-3">
            {!authed && <Link href="/login" className="hidden text-sm font-semibold text-muted transition hover:text-ink sm:block">Giriş</Link>}
            <Link href={primaryHref} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600">{primaryLabel}</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(680px 360px at 80% -6%, rgba(234,91,26,.14), transparent 60%)' }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              KKTC & Türkiye · Restoran · Otel · Bar · Plaj
            </span>
            <h1 className="mt-5 text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-balance sm:text-6xl">
              Masadaki QR, <span className="text-brand-600">koca bir servis sistemi.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Premium QR menüden masadan siparişe, garson çağırmadan online ödemeye — misafirin telefonunda biten, uygulama gerektirmeyen dijital restoran platformu.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={primaryHref} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 hover:shadow-md">
                {authed ? 'Panele Git' : 'Ücretsiz Dene'}
                <Icon d="M5 12h14M13 6l6 6-6 6" />
              </Link>
              <a href="#ozellikler" className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-6 py-3.5 text-sm font-bold text-ink shadow-sm transition hover:bg-canvas">
                Özellikleri Gör
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {['14 gün ücretsiz deneme', 'Kredi kartı gerekmez', 'Dakikalar içinde kurulum'].map((x) => (
                <span key={x} className="inline-flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-500" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  {x}
                </span>
              ))}
            </div>
          </div>

          {/* Phone mockup */}
          <div className="relative flex justify-center">
            <div className="absolute -left-3 top-10 z-10 hidden items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm font-semibold shadow-lg sm:flex">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600"><Icon d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /></span>
              Garson çağrıldı · Masa 7
            </div>
            <div className="absolute -right-4 bottom-20 z-10 hidden items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm font-semibold shadow-lg sm:flex">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600"><Icon d="M20 7 9 18l-5-5" /></span>
              Sipariş mutfağa düştü
            </div>
            <div className="w-[290px] max-w-full rounded-[2.6rem] border border-line bg-surface p-3 shadow-2xl">
              <div className="overflow-hidden rounded-[2rem] bg-canvas">
                <div className="relative h-36" style={{ background: 'linear-gradient(150deg,#c9490f,#ea5b1a 55%,#f6944f)' }}>
                  <div className="absolute inset-x-3 top-3 flex justify-between">
                    <span className="rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-ink shadow">🌐 Türkçe</span>
                    <span className="rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-ink shadow">🛒</span>
                  </div>
                  <div className="absolute inset-x-0 bottom-3 text-center text-2xl font-extrabold italic tracking-wide text-amber-50" style={{ textShadow: '0 0 16px rgba(255,220,150,.6)' }}>COCKTAILS</div>
                </div>
                <div className="flex items-center gap-2.5 bg-surface p-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl text-sm font-extrabold text-white" style={{ background: 'linear-gradient(135deg,#c9490f,#ea5b1a)' }}>GM</span>
                  <div>
                    <div className="text-sm font-extrabold">Girne Meze Bahçesi</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-red-500"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />Kapalı · 11:00–23:00</div>
                  </div>
                </div>
                <div className="space-y-2 bg-canvas p-3">
                  {[['Adana Kebap', 'Acılı el yapımı zırh kıyma…', '₺260'], ['Humus', 'Nohut püresi, tahin…', '₺90']].map(([n, d, p], i) => (
                    <div key={n} className="flex gap-2.5 rounded-2xl border border-line bg-surface p-2.5 shadow-sm">
                      <span className="h-12 w-12 shrink-0 rounded-xl" style={{ background: i === 0 ? 'linear-gradient(135deg,#e8a24a,#d9762f)' : 'linear-gradient(135deg,#e0873a,#c9490f)' }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold">{n}</div>
                        <div className="truncate text-[11px] text-muted">{d}</div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[13px] font-extrabold">{p}</span>
                          <span className="rounded-full bg-brand-500 px-3 py-1 text-[11px] font-bold text-white">+ Ekle</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* STATS */}
      <div className="border-y border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-6">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">Tek platform, uçtan uca</span>
          <div className="flex flex-wrap gap-10">
            {[['5', 'Misafir dili'], ['4', 'İşletme türü'], ['3', 'Menü teması'], ['0', 'Uygulama indirme']].map(([n, l]) => (
              <div key={l}>
                <div className="text-2xl font-extrabold tracking-tight">{n}</div>
                <div className="text-xs font-semibold text-muted">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* GUEST FEATURES */}
      <section id="ozellikler" className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-600">Misafir Deneyimi</span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Menüyü taramaktan çok daha fazlası</h2>
          <p className="mt-4 text-lg text-muted">Misafirin telefonunda; menü, sipariş, servis ve ödeme — hepsi tek QR ile, sade ve hızlı.</p>
        </div>
        <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {GUEST_FEATURES.map((f) => (
            <div key={f.t}>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon d={f.d1} /></span>
              <h3 className="mt-4 text-base font-bold">{f.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* VERTICALS */}
      <section id="turler" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-600">Tek Sistem, Dört Dikey</span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">İşletmeniz ne olursa olsun</h2>
            <p className="mt-4 text-lg text-muted">Kayıt sırasında türünüzü seçin; sistem kendini ona göre kurar.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VERTICALS.map((v) => (
              <div key={v.t} className="rounded-2xl border border-line bg-canvas p-6 transition hover:-translate-y-1 hover:shadow-md">
                <div className="text-3xl">{v.e}</div>
                <h3 className="mt-3 text-base font-bold">{v.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OPS FEATURES */}
      <section className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-600">İşletme Yönetimi</span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Mutfaktan kasaya tek panel</h2>
          <p className="mt-4 text-lg text-muted">Siparişi almak yalnızca başlangıç — servisi, ödemeyi, stoğu ve markayı da yönetin.</p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {OPS_FEATURES.map((f) => (
            <div key={f.t} className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <h3 className="text-base font-bold">{f.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="nasil" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-600">Nasıl Çalışır</span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Üç adımda yayında</h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              ['01', 'Menünü oluştur', 'Kategori, ürün, fotoğraf, varyant ve ekstraları panelden ekle. Fotoğraftan menü içe aktarma ile dakikalar içinde.'],
              ['02', 'QR’ı masaya koy', 'Her masa/oda/şezlong için QR üret, yazdır. Misafir tarar — uygulama indirmeden menü ve sipariş açılır.'],
              ['03', 'Her şeyi yönet', 'Siparişler mutfak ekranına, çağrılar personele düşer. Satış, stok ve itibarı tek panelden izle.'],
            ].map(([n, t, d]) => (
              <div key={n}>
                <div className="flex items-center gap-3 text-sm font-extrabold tracking-widest text-brand-600">
                  {n}<span className="h-px flex-1 bg-line" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="fiyatlar" className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-600">Fiyatlandırma</span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">İşletmenizle büyüyen planlar</h2>
          <p className="mt-4 text-lg text-muted">Ücretsiz başlayın, 14 gün deneyin. Komisyon yok, gizli ücret yok.</p>
        </div>
        <div className="mt-14 grid gap-5 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div key={p.name} className={`relative flex flex-col rounded-2xl border bg-surface p-6 ${p.feat ? 'border-brand-500 shadow-lg' : 'border-line shadow-sm'}`}>
              {p.feat && <span className="absolute -top-3 left-6 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">En popüler</span>}
              <div className="text-sm font-bold">{p.name}</div>
              <div className="mt-3 text-4xl font-extrabold tracking-tight">{p.price}<span className="text-sm font-semibold text-muted">{p.per}</span></div>
              <p className="mt-2 min-h-[40px] text-sm text-muted">{p.desc}</p>
              <ul className="my-6 flex-1 space-y-3">
                {p.items.map((it) => (
                  <li key={it} className="flex gap-2.5 text-sm">
                    <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    {it}
                  </li>
                ))}
              </ul>
              <Link href={p.name === 'Kurumsal' ? '/register' : '/register'} className={`rounded-xl py-2.5 text-center text-sm font-bold transition ${p.feat ? 'bg-brand-500 text-white hover:bg-brand-600' : 'border border-line bg-surface text-ink hover:bg-canvas'}`}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="relative overflow-hidden rounded-3xl px-6 py-16 text-center shadow-xl" style={{ background: 'radial-gradient(120% 140% at 50% -20%,#ea5b1a,#9e3a0c 72%)' }}>
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white text-balance sm:text-4xl">Menünüzü bugün akıllı hale getirin.</h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/85">Kurulum dakikalar sürer, misafirleriniz farkı ilk taramada görür.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={primaryHref} className="rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-brand-700 shadow-sm transition hover:bg-white/90">{authed ? 'Panele Git' : 'Ücretsiz Hesap Aç'}</Link>
            {!authed && <Link href="/login" className="rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">Giriş Yap</Link>}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 font-extrabold text-white">Q</span>
                <span className="text-lg font-extrabold tracking-tight">ComiQR</span>
              </div>
              <p className="mt-4 max-w-xs text-sm text-muted">Restoran, otel, bar ve plaj işletmeleri için uçtan uca QR menü, sipariş ve servis platformu.</p>
            </div>
            {[
              ['Ürün', [['Özellikler', '#ozellikler'], ['İşletme türleri', '#turler'], ['Fiyatlar', '#fiyatlar'], ['Nasıl çalışır', '#nasil']]],
              ['Başla', [['Ücretsiz kayıt', '/register'], ['Giriş', '/login'], ['Panel', '/dashboard']]],
              ['Şirket', [['İletişim', '#'], ['Gizlilik', '#'], ['Koşullar', '#']]],
            ].map(([h, links]) => (
              <div key={h as string}>
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted">{h as string}</h4>
                <div className="mt-4 space-y-2.5">
                  {(links as [string, string][]).map(([l, href]) => (
                    <Link key={l} href={href} className="block text-sm font-medium text-ink/80 transition hover:text-brand-600">{l}</Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap justify-between gap-3 border-t border-line pt-6 text-sm text-muted">
            <span>© 2026 ComiQR. Tüm hakları saklıdır.</span>
            <span>Kıbrıs · Türkiye</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
