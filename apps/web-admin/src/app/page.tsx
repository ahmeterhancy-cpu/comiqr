'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
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

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-500" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Arrow() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

/* ---- Feature section: text + checklist on one side, mockup on the other ---- */
function FeatureSection({ badge, title, body, points, mockup, flip }: { badge: string; title: string; body: string; points: string[]; mockup: ReactNode; flip?: boolean }) {
  return (
    <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:gap-16 lg:py-20">
      <div className={flip ? 'lg:order-2' : ''}>
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-600">{badge}</span>
        <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-balance sm:text-[2.4rem]">{title}</h2>
        <p className="mt-4 text-lg leading-relaxed text-muted">{body}</p>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex gap-3 text-[15px]"><Check /><span>{p}</span></li>
          ))}
        </ul>
      </div>
      <div className={flip ? 'lg:order-1' : ''}>{mockup}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- Mockups */
function MockImport() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold">Menüyü Düzenle</span>
        <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-600">Fotoğraftan içe aktarıldı</span>
      </div>
      <div className="space-y-2">
        {[['Adana Kebap', '₺260', 'linear-gradient(135deg,#e8a24a,#d9762f)'], ['Humus', '₺90', 'linear-gradient(135deg,#7ba05b,#4f7a3a)'], ['Sezar Salata', '₺130', 'linear-gradient(135deg,#8bbf5a,#5a9e3a)']].map(([n, p, g]) => (
          <div key={n} className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-2.5">
            <span className="h-11 w-11 shrink-0 rounded-lg" style={{ background: g }} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold">{n}</div>
              <div className="text-[11px] text-muted">Malzeme, alerjen ve besin değeri okundu</div>
            </div>
            <span className="text-[13px] font-extrabold">{p}</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-500" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockLive() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl">
      <div className="grid grid-cols-2 gap-3">
        {[['Klasik', '₺120', false], ['Kampanya', '₺96', true]].map(([t, p, promo]) => (
          <div key={t as string} className={`rounded-xl border p-3 ${promo ? 'border-brand-500 bg-brand-50' : 'border-line bg-canvas'}`}>
            <span className="h-16 w-full rounded-lg" style={{ display: 'block', background: 'linear-gradient(135deg,#e8a24a,#d9762f)' }} />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[13px] font-bold">Margarita Pizza</span>
              {promo ? <span className="rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">-%20</span> : null}
            </div>
            <div className="text-[13px] font-extrabold text-brand-600">{p as string}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-canvas p-2.5 text-[12px] text-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" /> Değişiklik misafirlere anında yansıdı
      </div>
    </div>
  );
}

function MockOrder() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold">Mutfak Ekranı (KDS)</span>
        <span className="rounded-md bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">Canlı</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[['Masa 7', ['1× Adana Kebap', '2× Ayran'], 'Hazırlanıyor'], ['Masa 3', ['1× Humus', '1× Kuzu Şiş'], 'Yeni']].map(([tbl, items, st]) => (
          <div key={tbl as string} className="rounded-xl border border-line bg-canvas p-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-extrabold">{tbl as string}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${st === 'Yeni' ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-700'}`}>{st as string}</span>
            </div>
            <ul className="mt-2 space-y-1 text-[12px] text-muted">
              {(items as string[]).map((i) => <li key={i}>{i}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <span className="flex-1 rounded-lg bg-brand-500 py-2 text-center text-[12px] font-bold text-white">🔔 Garson çağrıldı · Masa 7</span>
      </div>
    </div>
  );
}

function MockChat() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-xl">
      <div className="mb-3 flex items-center gap-2 border-b border-line pb-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-sm text-white">🤖</span>
        <div><div className="text-[13px] font-bold">Menü Asistanı</div><div className="text-[11px] text-brand-600">● çevrimiçi</div></div>
      </div>
      <div className="space-y-2.5">
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-500 px-3.5 py-2 text-[13px] text-white">Glutensiz ve az kalorili ne önerirsin?</div>
        <div className="mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-canvas px-3.5 py-2 text-[13px]">Kuzu Şiş (glutensiz, 560 kcal) veya Çoban Salata (vegan, 90 kcal) harika olur. İster misiniz?</div>
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-500 px-3.5 py-2 text-[13px] text-white">Kaçta kapanıyorsunuz?</div>
        <div className="mr-auto max-w-[70%] rounded-2xl rounded-tl-sm bg-canvas px-3.5 py-2 text-[13px]">Bugün 23:00’a kadar açığız 🌙</div>
      </div>
    </div>
  );
}

function MockAnalytics() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl">
      <div className="grid grid-cols-3 gap-3">
        {[['8.950', 'Menü açılışı'], ['125.280', 'Görüntülenme'], ['4dk 9sn', 'Ort. süre']].map(([n, l]) => (
          <div key={l} className="rounded-xl bg-canvas p-3 text-center">
            <div className="text-lg font-extrabold tracking-tight">{n}</div>
            <div className="text-[10px] font-semibold text-muted">{l}</div>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 320 110" className="mt-4 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="af" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ea5b1a" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ea5b1a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 80 C 40 70, 60 40, 90 48 S 150 88, 190 60 S 260 18, 320 34 L320 110 L0 110 Z" fill="url(#af)" />
        <path d="M0 80 C 40 70, 60 40, 90 48 S 150 88, 190 60 S 260 18, 320 34" fill="none" stroke="#ea5b1a" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* --------------------------------------------------------------- Content */
const VERTICALS = [
  { e: '🍽️', t: 'Restoran & Kafe', d: 'Masa siparişi, gel-al ve teslimat; garson çağırma ve hesap akışı.' },
  { e: '🏨', t: 'Otel', d: 'Oda servisi ve odaya yansıtma (folyo); çıkışta tek hesap.' },
  { e: '🍹', t: 'Bar & Pub', d: 'Adisyon akışı, 18+ işaret ve otomatik Happy Hour indirimi.' },
  { e: '🏖️', t: 'Plaj Kulübü', d: 'Şezlong servisi ve şezlonga yansıtma; sahilden sipariş.' },
];

const PLANS = [
  { name: 'Başlangıç', price: '₺0', per: '/ay', desc: 'Dijital QR menüye geçen küçük işletmeler için.', cta: 'Ücretsiz Başla', feat: false,
    items: ['QR menü + 3 tema', 'Çalışma saati, WiFi, iletişim', 'Besin değeri & alerjen', '5 dil', 'Fotoğraftan menü içe aktarma'] },
  { name: 'Pro', price: '₺29', per: '/ay', desc: 'Masadan sipariş ve servis akışı isteyenler için.', cta: '14 Gün Ücretsiz', feat: true,
    items: ['Başlangıç’taki her şey', 'Sepet, sipariş & mutfak ekranı (KDS)', 'Garson çağır & hesap iste', 'Online ödeme (Tiko)', 'AI menü asistanı & analitik'] },
  { name: 'Business', price: '₺79', per: '/ay', desc: 'Otel, plaj ve çok şubeli işletmeler için.', cta: '14 Gün Ücretsiz', feat: false,
    items: ['Pro’daki her şey', 'Otel & plaj (folyo)', 'Çok şube & personel POS', 'Sadakat: puan & kupon', 'Gelişmiş raporlar'] },
  { name: 'Kurumsal', price: 'Özel', per: '', desc: 'Markalı deneyim ve öncelikli destek.', cta: 'İletişime Geç', feat: false,
    items: ['Business’taki her şey', 'White-label & kendi alan adı', 'AI içgörüler & API', 'Öncelikli destek & SLA'] },
];

const FAQS = [
  ['Menüyü tekrar tekrar bastırıyor musunuz?', 'Fiyat mı değişti, ürün mü tükendi? Panelden düzenlersiniz, misafirin telefonuna anında yansır. Baskı, bekleme, çöpe giden menü yok.'],
  ['Turistler menünüzü okuyamıyor mu?', 'Menü 5 dilde (TR, EN, DE, RU, AR). Misafir kendi dilini seçer; AI asistan da sorularını kendi dilinde yanıtlar.'],
  ['Personel her gün aynı soruları mı yanıtlıyor?', '“Bu glutensiz mi? Kaçta kapanıyorsunuz?” — AI asistan malzeme, alerjen, saat ve kampanyayı bilir, gece gündüz yanıtlar.'],
  ['Siparişleri ve masaları zor mu yönetiyorsunuz?', 'Sepet → sipariş → mutfak ekranı (KDS) → ödeme tek akışta. Garson çağır/hesap iste çağrıları personele anında düşer.'],
  ['Menünüzün nasıl performans gösterdiğini bilmiyor musunuz?', 'Kaç açılış, hangi ürün öne çıktı, ortalama süre — hepsi analitikte. Değerlendirme ve itibar puanıyla memnuniyeti izleyin.'],
  ['Birden fazla şube mi yönetiyorsunuz?', 'Çok şube desteği, şube bazlı menü ve raporlar; markalı (white-label) deneyim ve kendi alan adınız.'],
];

const MORE = [
  { t: 'Ürün detay ekranı', b: 'Karta dokunan misafir büyük görsel, açıklama, alerjen, besin değerleri ve “kaç gram et” malzeme reçetesini tek ekranda görür.', d: 'M4 4h16v16H4zM4 14l4-4 4 4 3-3 5 5M8.5 9.5a1 1 0 100-.01' },
  { t: 'Alerjen filtreleri', b: 'Misafir menüyü glutensiz, laktozsuz ya da alerjensiz olacak şekilde tek dokunuşla süzer.', d: 'M3 4h18l-7 9v6l-4 2v-8z' },
  { t: 'Kampanya & kupon', b: 'Zamanlı kampanyalar, indirim kodları ve kategoriye toplu indirim; barda happy hour otomatik uygulanır.', d: 'M3 7v5l8 8 9-9-8-8H6a3 3 0 00-3 3zM7.5 7.5h.01' },
  { t: 'AI Danışman (işletme)', b: 'Panelde yapay zekâ; öne çıkan ürünleri, menü boşluklarını ve misafir yorumlarının özetini çıkarır.', d: 'M3 3v18h18M7 14l3-3 3 2 5-6' },
];

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<number | null>(0);

  useEffect(() => {
    setAuthed(isAuthenticated());
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const primaryHref = authed ? '/dashboard' : '/register';

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
            <a href="#fiyatlar" className="text-sm font-semibold text-muted transition hover:text-ink">Fiyatlar</a>
            <a href="#sss" className="text-sm font-semibold text-muted transition hover:text-ink">S.S.S.</a>
          </div>
          <div className="flex items-center gap-3">
            {!authed && <Link href="/login" className="hidden text-sm font-semibold text-muted transition hover:text-ink sm:block">Giriş</Link>}
            <Link href={primaryHref} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600">{authed ? 'Panele Git' : 'Ücretsiz Dene'}</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(720px 380px at 12% -10%, rgba(234,91,26,.16), transparent 60%)' }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="text-[2.7rem] font-extrabold leading-[1.04] tracking-tight text-balance sm:text-6xl">
              Menünüz kağıttan <span className="text-brand-600">daha iyisini hak ediyor.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              ComiQR, kağıt menünüzü dijitalleştiren uçtan uca bir sistemdir. Bir kez kurarsınız; fiyatı, ürünü ve kampanyayı telefonunuzdan saniyeler içinde değiştirirsiniz. Misafirleriniz menüyü kendi telefonlarında, kendi dillerinde — daha masaya oturmadan görür.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={primaryHref} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 hover:shadow-md">
                {authed ? 'Panele Git' : 'Ücretsiz Dene'} <Arrow />
              </Link>
              <a href="#ozellikler" className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-6 py-3.5 text-sm font-bold text-ink shadow-sm transition hover:bg-canvas">Örnek Menü</a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {['30 gün ücretsiz deneme', 'Kurulum ücreti yok', 'İstediğin an iptal'].map((x) => (
                <span key={x} className="inline-flex items-center gap-2"><Check />{x}</span>
              ))}
            </div>
          </div>

          {/* Phone + QR */}
          <div className="relative flex justify-center">
            <div className="w-[280px] max-w-full rounded-[2.6rem] border border-line bg-surface p-3 shadow-2xl">
              <div className="overflow-hidden rounded-[2rem] bg-canvas">
                <div className="relative h-32" style={{ background: 'linear-gradient(150deg,#c9490f,#ea5b1a 55%,#f6944f)' }}>
                  <div className="absolute inset-x-3 top-3 flex justify-between">
                    <span className="rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-ink shadow">🌐 Türkçe</span>
                    <span className="rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-ink shadow">🛒</span>
                  </div>
                  <div className="absolute inset-x-0 bottom-3 text-center text-2xl font-extrabold italic tracking-wide text-amber-50">BOWLS</div>
                </div>
                <div className="space-y-2 p-3">
                  {[['Adana Kebap', '₺260', 'linear-gradient(135deg,#e8a24a,#d9762f)'], ['Sezar Salata', '₺130', 'linear-gradient(135deg,#8bbf5a,#5a9e3a)']].map(([n, p, g]) => (
                    <div key={n} className="flex gap-2.5 rounded-2xl border border-line bg-surface p-2.5 shadow-sm">
                      <span className="h-11 w-11 shrink-0 rounded-xl" style={{ background: g }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold">{n}</div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[13px] font-extrabold">{p}</span>
                          <span className="rounded-full bg-brand-500 px-2.5 py-0.5 text-[10px] font-bold text-white">+ Ekle</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -left-3 rounded-2xl border border-line bg-surface p-2.5 shadow-xl sm:-left-6">
              <QrGlyph />
            </div>
          </div>
        </div>
      </header>

      {/* TRUSTED STRIP */}
      <div className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-6">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-muted">Restoran, kafe, otel, bar ve plaj işletmelerinin tercihi</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-semibold text-muted">
            {['🍽️ Fine Dining', '🥩 Steakhouse', '🍣 Sushi Bar', '☕ Kafe', '🏨 Otel Spa', '🍹 Beach Club', '➕ Sıradaki siz?'].map((x) => (
              <span key={x} className="opacity-80">{x}</span>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURE SECTIONS */}
      <div id="ozellikler" className="divide-y divide-line">
        <FeatureSection
          badge="Yeni özellik"
          title="Fotoğrafını çek, menüyü biz kuralım."
          body="Eskiden en çok yorulduğunuz kısım artık yok. Basılı menünüzün birkaç fotoğrafını çekin ya da PDF yükleyin; her kategori, ürün, açıklama ve fiyat — hatta malzeme, alerjen ve besin değerleri sayfadan okunup doldurulur. Siz hiçbir şey yazmazsınız."
          points={['Menü fotoğraflarını çek ya da PDF yükle', 'Her kategori, ürün ve açıklama sırasıyla', 'Her boy ve fiyatı ayrı ayrı', 'Malzeme, alerjen ve besin değeri otomatik', 'Gözden geçir, kaydet — menün hazır']}
          mockup={<MockImport />}
        />
        <FeatureSection
          flip
          badge="Dijital menü"
          title="Paneliniz menünüzdür. Canlı düzenleyin."
          body="Düzenlediğiniz şey, misafirin gördüğü şeydir; her değişiklik anında telefonlarına ulaşır. Yeniden baskı yok, bekleme yok, menünüz asla güncelliğini yitirmez."
          points={['Ürünleri sürükleyip sırala ya da başka kategoriye taşı', 'Tek ürünü veya tüm kategoriyi tek düğmeyle gizle', 'İsim, fiyat, boy, açıklama, malzeme, alerjen — hepsini düzenle', 'İndirimli fiyatla öne çıkar ya da “kampanya” işaretle', 'Bir kategoriye toplu indirim uygula (ör. %20)']}
          mockup={<MockLive />}
        />
        <FeatureSection
          badge="Sipariş & Servis"
          title="Sadece menü değil — masadan sipariş, servis ve ödeme."
          body="ComiQR menüyü göstermekle kalmaz. Misafir sepete ekler; masada, gel-al veya teslimat siparişi verir, garson çağırır veya hesap ister. Sipariş mutfak ekranına (KDS), çağrı personele anında düşer."
          points={['Varyant ve ekstra seçenekli sepet', 'Masada, gel-al ve teslimat', 'Garson çağır & hesap iste — masayı seçerek', 'Mutfak ekranı (KDS), personel POS ve garson app', 'Online ödeme (Tiko) — kapıda ya da online']}
          mockup={<MockOrder />}
        />
        <FeatureSection
          flip
          badge="Anında yanıt"
          title="Kendi kendine yanıtlayan menü."
          body="Misafir menü hakkında her şeyi sorabilir; asistan malzeme, alerjen, fiyat ve kampanyalara göre kendi dilinde yanıtlar. Ekibiniz aynı soruları tekrar tekrar cevaplamaktan kurtulur."
          points={['Her ürünü; malzeme, alerjen ve fiyatını bilir', 'Her misafire kendi dilinde otomatik yanıt', 'Bütçe, iştah veya diyete göre öneri (ör. glutensiz)', 'Çalışma saati, konum, WiFi ve güncel kampanyalar', 'Gece gündüz, kapalıyken bile']}
          mockup={<MockChat />}
        />
        <FeatureSection
          badge="Analitik"
          title="Menünüzün nasıl performans gösterdiğini görün."
          body="Menünüzü kaç kişi açtı, ne kadar süre inceledi, hangi ürünler öne çıktı — hepsini görün. Değerlendirme ve itibar puanıyla misafir memnuniyetini takip edin."
          points={['Günlük menü açılışları', 'Görüntülenme ve ortalama inceleme süresi', 'En çok bakılan ürünler', 'Değerlendirme & yorumlar, itibar puanı', 'Tek tıkla dışa aktar (rapor)']}
          mockup={<MockAnalytics />}
        />
      </div>

      {/* VERTICALS */}
      <section id="turler" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-600">Tek Sistem, Dört Dikey</span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">İşletmeniz ne olursa olsun</h2>
            <p className="mt-4 text-lg text-muted">Kayıt sırasında türünüzü seçin; sistem kendini ona göre kurar — masalar, odalar, şezlonglar veya adisyon.</p>
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

      {/* MORE FEATURES */}
      <section className="mx-auto max-w-6xl px-5 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-600">Menüde & Panelde</span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Ve dahası</h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MORE.map((f) => (
            <div key={f.t} className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={f.d} /></svg>
              </span>
              <h3 className="mt-4 text-base font-bold">{f.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="fiyatlar" className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-[2.6rem]">Ücretsiz başlayın.<br /><span className="text-brand-600">Hazır olunca büyüyün.</span></h2>
          <p className="mt-4 text-lg text-muted">14 gün deneyin, komisyon yok, gizli ücret yok. İstediğiniz an yükseltin.</p>
        </div>
        <div className="mt-14 grid gap-5 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div key={p.name} className={`relative flex flex-col rounded-2xl border bg-surface p-6 ${p.feat ? 'border-brand-500 shadow-lg ring-1 ring-brand-100' : 'border-line shadow-sm'}`}>
              {p.feat && <span className="absolute -top-3 left-6 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">En popüler</span>}
              <div className="text-sm font-bold">{p.name}</div>
              <div className="mt-3 text-4xl font-extrabold tracking-tight">{p.price}<span className="text-sm font-semibold text-muted">{p.per}</span></div>
              <p className="mt-2 min-h-[40px] text-sm text-muted">{p.desc}</p>
              <ul className="my-6 flex-1 space-y-3">
                {p.items.map((it) => (<li key={it} className="flex gap-2.5 text-sm"><Check />{it}</li>))}
              </ul>
              <Link href={authed ? '/billing' : '/register'} className={`rounded-xl py-2.5 text-center text-sm font-bold transition ${p.feat ? 'bg-brand-500 text-white hover:bg-brand-600' : 'border border-line bg-surface text-ink hover:bg-canvas'}`}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="sss" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-20 lg:py-24">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Restoranların ortak dertleri.</h2>
            <p className="mt-3 text-lg text-brand-600 font-semibold">İşte her biri nasıl çözülüyor.</p>
          </div>
          <div className="mt-10 space-y-3">
            {FAQS.map(([q, a], i) => (
              <div key={q} className="overflow-hidden rounded-2xl border border-line bg-canvas">
                <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left" aria-expanded={open === i}>
                  <span className="text-[15px] font-bold">{q}</span>
                  <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-brand-600 transition-transform ${open === i ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </button>
                {open === i && <p className="px-5 pb-5 text-[15px] leading-relaxed text-muted">{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-14 gap-y-6 px-5 py-14 text-center">
        {[['1.000+', 'İşletme kullanıyor'], ['5', 'Misafir dili'], ['4', 'İşletme türü'], ['%100', 'Uygulamasız'], ['30 gün', 'Ücretsiz deneme']].map(([n, l]) => (
          <div key={l}>
            <div className="text-3xl font-extrabold tracking-tight text-brand-600">{n}</div>
            <div className="mt-1 text-xs font-semibold text-muted">{l}</div>
          </div>
        ))}
      </div>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="relative overflow-hidden rounded-3xl px-6 py-16 text-center shadow-xl" style={{ background: 'radial-gradient(120% 140% at 50% -20%,#ea5b1a,#9e3a0c 72%)' }}>
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white text-balance sm:text-4xl">İlk menünüz 30 gün ücretsiz.</h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/85">Kurulum dakikalar sürer, misafirleriniz farkı ilk taramada görür.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={primaryHref} className="rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-brand-700 shadow-sm transition hover:bg-white/90">{authed ? 'Panele Git' : 'Ücretsiz Dene'}</Link>
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
            {([
              ['Platform', [['Özellikler', '#ozellikler'], ['İşletme türleri', '#turler'], ['Fiyatlar', '#fiyatlar'], ['S.S.S.', '#sss']]],
              ['Başla', [['Ücretsiz kayıt', '/register'], ['Giriş', '/login'], ['Panel', '/dashboard']]],
              ['Şirket', [['İletişim', '#'], ['Gizlilik', '#'], ['Koşullar', '#']]],
            ] as [string, [string, string][]][]).map(([h, links]) => (
              <div key={h}>
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted">{h}</h4>
                <div className="mt-4 space-y-2.5">
                  {links.map(([l, href]) => (<Link key={l} href={href} className="block text-sm font-medium text-ink/80 transition hover:text-brand-600">{l}</Link>))}
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

/* Decorative QR glyph (not a real code). */
function QrGlyph() {
  const cells = [
    [1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
    [1,0,1,1,0,1,0,1,0,1,0,1,1,0,1,0,1],
    [0,1,0,0,1,0,1,0,1,0,1,0,0,1,0,1,0],
    [1,1,1,0,1,1,0,1,0,1,0,1,1,0,1,1,1],
    [0,0,0,0,0,0,0,0,1,1,0,1,0,1,0,0,0],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,1,0,1,0],
    [1,0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,1,0],
    [1,0,1,1,1,0,1,0,0,1,0,0,1,0,0,1,0],
    [1,1,1,1,1,1,1,0,1,0,1,1,0,1,1,0,1],
  ];
  return (
    <svg viewBox="0 0 17 17" className="h-16 w-16" shapeRendering="crispEdges">
      <rect width="17" height="17" fill="#fff" />
      {cells.flatMap((row, y) => row.map((c, x) => (c ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#13211b" /> : null)))}
    </svg>
  );
}
