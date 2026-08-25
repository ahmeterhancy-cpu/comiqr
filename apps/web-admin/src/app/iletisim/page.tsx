import { MarketingShell } from '@/components/MarketingShell';
import { OFFICES, TRIAL_DAYS, telHref } from '@/lib/marketing';

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
              {office.site && (
                <a
                  href={`https://${office.site}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted transition hover:text-brand-600"
                >
                  {office.site}
                </a>
              )}

              <address className="mt-3 not-italic text-sm leading-relaxed text-ink">
                {office.address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>

              <div className="mt-4 space-y-1.5 text-sm">
                <a href={telHref(office.phone)} className="block font-semibold text-ink transition hover:text-brand-600">
                  {office.phone}
                </a>
                <a href={`mailto:${office.email}`} className="block text-muted transition hover:text-brand-600">
                  {office.email}
                </a>
              </div>
            </div>
          ))}
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
