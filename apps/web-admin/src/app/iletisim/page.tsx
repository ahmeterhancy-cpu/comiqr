import { MarketingShell } from '@/components/MarketingShell';

export const metadata = { title: 'İletişim — ComiQR' };

const CHANNELS = [
  { t: 'E-posta', v: 'info@comiqr.com', href: 'mailto:info@comiqr.com', d: 'Sorular, destek ve iş birliği için.', icon: 'M3 5h18v14H3zM3 7l9 6 9-6' },
  { t: 'WhatsApp', v: '+90 533 000 00 00', href: 'https://wa.me/905330000000', d: 'Hızlı destek ve demo talebi.', icon: 'M12 2a10 10 0 00-8.6 15L2 22l5.1-1.3A10 10 0 1012 2z' },
  { t: 'Telefon', v: '+90 533 000 00 00', href: 'tel:+905330000000', d: 'Hafta içi 09:00 – 18:00.', icon: 'M5 3h4l2 5-3 2a12 12 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z' },
  { t: 'Adres', v: 'Lefkoşa, KKTC', href: 'https://maps.google.com/?q=Lefko%C5%9Fa', d: 'Kıbrıs & Türkiye.', icon: 'M12 21s-6-5.3-6-10a6 6 0 1112 0c0 4.7-6 10-6 10zM12 11a2 2 0 100-.01' },
];

export default function IletisimPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl px-5 py-16">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-600">İletişim</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Bize ulaşın</h1>
        <p className="mt-3 text-lg text-muted">Menünüzü dijitalleştirmek, demo görmek veya destek almak için buradayız. En kısa sürede dönüş yaparız.</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <a key={c.t} href={c.href} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-line bg-surface p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg>
              </span>
              <h2 className="mt-4 text-base font-bold">{c.t}</h2>
              <p className="mt-1 text-sm font-semibold text-ink group-hover:text-brand-600">{c.v}</p>
              <p className="mt-1 text-sm text-muted">{c.d}</p>
            </a>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-line bg-brand-50/60 p-6">
          <h2 className="text-base font-bold">Demo mu istiyorsunuz?</h2>
          <p className="mt-1.5 text-sm text-muted">30 gün ücretsiz deneme hesabı açın; kartsız, dakikalar içinde canlı menünüz hazır olsun.</p>
          <a href="/register" className="mt-4 inline-flex rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Ücretsiz Dene</a>
        </div>
      </div>
    </MarketingShell>
  );
}
