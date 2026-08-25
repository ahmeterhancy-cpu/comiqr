import { MarketingShell } from '@/components/MarketingShell';
import { CONTACT_EMAIL, OFFICES, TRIAL_DAYS, telHref } from '@/lib/marketing';

export const metadata = {
  title: 'İletişim — ComiQR',
  description: 'Kıbrıs, Türkiye ve İngiltere ofislerimiz. Demo, destek ve teklif için bize ulaşın.',
};

export default function IletisimPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl px-5 py-16">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-600">İletişim</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Bize ulaşın</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Menünüzü dijitalleştirmek, demo görmek veya destek almak için buradayız. Size en yakın ofisi arayın;
          hafta içi 09:00 – 18:00 arası yanıtlıyoruz.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {OFFICES.map((office) => (
            <div key={office.region} className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <h2 className="text-base font-bold text-brand-600">{office.region}</h2>

              <address className="mt-3 not-italic text-sm leading-relaxed text-ink">
                {office.address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>

              <a href={telHref(office.phone)} className="mt-4 block text-sm font-semibold text-ink transition hover:text-brand-600">
                {office.phone}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-2.5 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink shadow-sm transition hover:border-brand-500 hover:text-brand-600"
          >
            <span className="text-brand-600">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18v14H3zM3 7l9 6 9-6" /></svg>
            </span>
            {CONTACT_EMAIL}
          </a>
        </div>

        <div className="mt-10 rounded-2xl border border-line bg-brand-50/60 p-6">
          <h2 className="text-base font-bold">Demo mu istiyorsunuz?</h2>
          <p className="mt-1.5 text-sm text-muted">
            {TRIAL_DAYS} gün ücretsiz deneme hesabı açın; kartsız, dakikalar içinde canlı menünüz hazır olsun.
          </p>
          <a href="/register" className="mt-4 inline-flex rounded-xl px-5 py-2.5 text-sm font-bold transition hover:opacity-90" style={{ background: '#ea5b1a', color: '#ffffff' }}>
            Ücretsiz Dene
          </a>
        </div>
      </div>
    </MarketingShell>
  );
}
