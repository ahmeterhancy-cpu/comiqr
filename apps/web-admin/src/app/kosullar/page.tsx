import { DocSection, MarketingShell } from '@/components/MarketingShell';

export const metadata = { title: 'Kullanım Koşulları — ComiQR' };

export default function KosullarPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl px-5 py-16">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-600">Yasal</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Kullanım Koşulları</h1>
        <p className="mt-3 text-sm text-muted">Son güncelleme: 11 Temmuz 2026</p>

        <p className="mt-6 text-[15px] leading-relaxed text-muted">
          Bu koşullar, ComiQR hizmetini kullanımınızı düzenler. Hesap oluşturarak veya hizmeti kullanarak bu koşulları kabul etmiş olursunuz.
        </p>

        <DocSection title="1. Hizmet">
          <p>ComiQR; QR menü, sipariş, servis çağrıları, ödeme ve işletme yönetimi araçları sunan bir yazılım hizmetidir (SaaS). Özellikler seçtiğiniz plana göre değişebilir.</p>
        </DocSection>

        <DocSection title="2. Hesap">
          <p>Hesap bilgilerinizin doğruluğundan ve gizliliğinden siz sorumlusunuz. Hesabınız altında gerçekleşen işlemlerden siz sorumlu tutulursunuz. Şüpheli bir durumda bizi bilgilendirin.</p>
        </DocSection>

        <DocSection title="3. İçerik">
          <p>Menü, görsel, fiyat ve açıklamalar dâhil girdiğiniz içeriğin doğruluğundan ve yasalara uygunluğundan siz sorumlusunuz. Yasa dışı veya üçüncü kişilerin haklarını ihlal eden içerik yayınlanamaz.</p>
        </DocSection>

        <DocSection title="4. Ücretlendirme ve abonelik">
          <p>Ücretli planlar, seçtiğiniz döneme göre (aylık/yıllık) tekrarlı olarak ödeme sağlayıcısı Tiko üzerinden tahsil edilir. 30 günlük ücretsiz deneme sonunda plana geçmezseniz ücretli özellikler kısıtlanır. Fiyatlar önceden bildirilerek güncellenebilir.</p>
        </DocSection>

        <DocSection title="5. İptal">
          <p>Aboneliğinizi istediğiniz an iptal edebilirsiniz; iptal, içinde bulunulan dönemin sonunda geçerli olur. Yürürlükteki tüketici mevzuatı saklıdır.</p>
        </DocSection>

        <DocSection title="6. Kabul edilebilir kullanım">
          <p>Hizmeti; sistemin güvenliğini tehlikeye atacak, aşırı yük bindirecek veya yasa dışı amaçlarla kullanamazsınız. Aksi hâlde hesabınız askıya alınabilir.</p>
        </DocSection>

        <DocSection title="7. Sorumluluğun sınırı">
          <p>Hizmet “olduğu gibi” sunulur. Kesintisiz veya hatasız çalışacağına dair garanti verilmez. Yürürlükteki hukukun izin verdiği ölçüde, dolaylı zararlardan sorumlu tutulamayız.</p>
        </DocSection>

        <DocSection title="8. Fikri mülkiyet">
          <p>ComiQR yazılımı ve markası bize aittir. Girdiğiniz menü içeriği ise size aittir; hizmeti sunmak için gereken sınırlı kullanım hakkını bize verirsiniz.</p>
        </DocSection>

        <DocSection title="9. Değişiklikler">
          <p>Bu koşulları zaman zaman güncelleyebiliriz. Önemli değişiklikleri makul biçimde bildiririz; kullanıma devam etmeniz güncel koşulları kabul ettiğiniz anlamına gelir.</p>
        </DocSection>

        <DocSection title="10. Geçerli hukuk ve iletişim">
          <p>Bu koşullar KKTC hukukuna tabidir. Sorularınız için: <a className="font-semibold text-brand-600 hover:underline" href="mailto:info@comiqr.com">info@comiqr.com</a></p>
        </DocSection>

        <p className="mt-10 rounded-xl bg-canvas p-4 text-xs text-muted">
          Bu metin genel bilgilendirme amaçlı bir örnek şablondur. Yürürlüğe koymadan önce hukuk danışmanınıza göre uyarlamanız önerilir.
        </p>
      </div>
    </MarketingShell>
  );
}
