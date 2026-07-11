import { DocSection, MarketingShell } from '@/components/MarketingShell';

export const metadata = { title: 'Gizlilik Politikası — ComiQR' };

export default function GizlilikPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl px-5 py-16">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-600">Yasal</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Gizlilik Politikası</h1>
        <p className="mt-3 text-sm text-muted">Son güncelleme: 11 Temmuz 2026</p>

        <p className="mt-6 text-[15px] leading-relaxed text-muted">
          ComiQR (“biz”), işletmelere QR menü, sipariş ve servis hizmeti sunar. Bu politika; hizmeti kullanan işletmelerin ve menüyü görüntüleyen misafirlerin kişisel verilerini nasıl işlediğimizi açıklar. Verilerinizi KKTC ve Türkiye mevzuatı (KVKK) ile uyumlu şekilde işleriz.
        </p>

        <DocSection title="1. Topladığımız veriler">
          <p><b>İşletme hesapları:</b> ad-soyad, işletme adı, e-posta, telefon ve ödeme için gerekli iletişim bilgileri.</p>
          <p><b>Menü içeriği:</b> ürünler, fiyatlar, görseller, malzeme ve besin bilgileri işletme tarafından girilir.</p>
          <p><b>Misafir kullanımı:</b> menü görüntüleme sayısı, seçilen dil ve — sipariş verildiyse — sipariş içeriği ve teslimat/iletişim bilgileri. QR menüyü yalnızca görüntülemek için hesap veya kişisel veri gerekmez.</p>
        </DocSection>

        <DocSection title="2. Verileri kullanma amacımız">
          <p>Hizmeti sunmak ve sürdürmek, siparişleri işleme almak, ödeme almak, destek sağlamak, güvenliği korumak ve hizmeti iyileştirmek için verileri işleriz.</p>
        </DocSection>

        <DocSection title="3. Ödeme verileri">
          <p>Ödeme ve abonelik işlemleri, lisanslı ödeme altyapısı <b>Tiko</b> üzerinden 3D Secure ile yürütülür. Kart bilgileriniz bizim sunucularımızda saklanmaz; ödeme sağlayıcısı tarafından güvenli biçimde işlenir.</p>
        </DocSection>

        <DocSection title="4. Çerezler">
          <p>Oturum ve tercih (ör. dil) yönetimi için gerekli çerezleri kullanırız. Analitik amaçlı çerezler yalnızca hizmetin performansını ölçmek içindir ve tarayıcınızdan yönetilebilir.</p>
        </DocSection>

        <DocSection title="5. Üçüncü taraflarla paylaşım">
          <p>Verilerinizi satmayız. Yalnızca hizmeti sunmak için gereken tedarikçilerle (ör. ödeme sağlayıcısı, SMS/e-posta bildirimi, barındırma) ve yasal zorunluluk hâlinde yetkili mercilerle paylaşırız.</p>
        </DocSection>

        <DocSection title="6. Saklama süresi">
          <p>Verileri, hizmet ilişkisi sürdüğü ve yasal yükümlülükler gerektirdiği sürece saklarız. Hesabınızı kapattığınızda, saklama yükümlülüğü olmayan verileri makul süre içinde sileriz veya anonimleştiririz.</p>
        </DocSection>

        <DocSection title="7. Haklarınız">
          <p>Kişisel verilerinize erişme, düzeltme, silme ve işlemeye itiraz etme haklarına sahipsiniz. Taleplerinizi <a className="font-semibold text-brand-600 hover:underline" href="mailto:info@comiqr.com">info@comiqr.com</a> adresine iletebilirsiniz.</p>
        </DocSection>

        <DocSection title="8. İletişim">
          <p>Gizlilikle ilgili sorularınız için: <a className="font-semibold text-brand-600 hover:underline" href="mailto:info@comiqr.com">info@comiqr.com</a></p>
        </DocSection>

        <p className="mt-10 rounded-xl bg-canvas p-4 text-xs text-muted">
          Bu metin genel bilgilendirme amaçlıdır ve bir örnek şablondur. Yürürlüğe koymadan önce hukuk danışmanınıza göre uyarlamanız önerilir.
        </p>
      </div>
    </MarketingShell>
  );
}
