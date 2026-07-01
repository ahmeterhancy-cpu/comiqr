# 01 — Ürün Vizyonu, Pazar ve Konumlandırma

## 1.1 Vizyon

Restoran işletmelerinin QR menüsünü basit bir "dijital PDF"ten çıkarıp, gelir
üreten bir **dijital satış yüzeyine** ve tam bir **operasyon beynine**
dönüştürmek. Menü; sipariş, ödeme, mutfak, stok, pazarlama ve besin verisini tek
akışta birleştirir.

İkinci katman olarak, kurulu işletme tabanının üstüne bir **tüketici keşif portalı
(app + web)** kurularak ürün tek yönlü B2B SaaS'tan **iki taraflı bir pazara
(B2B2C marketplace)** dönüşür: tüketiciler konum/şehir/ülke bazlı tüm işletmeleri
ve canlı menülerini keşfeder; işletmeler tüketici çeker, tüketici trafiği yeni
işletme çeker (ağ etkisi). Detay: `docs/02` **M20**.

## 1.2 Problem

- Piyasadaki "QR menü"lerin çoğu üstüne QR yapıştırılmış PDF: yavaş, kötü, sipariş kaybettiren.
- Alt segment tamamen komoditeleşti, fiyat dibe vurdu — orada yarışmak anlamsız.
- İşletmeler ise parçalı sistemler kullanıyor: menü ayrı, POS ayrı, mutfak ayrı, pazarlama ayrı, besin/reçete hiç yok.
- Turizm bölgesinde (KKTC) çok dilli, yerel ödemeli, otel/plaj senaryolarını çözen entegre bir ürün yok.

## 1.3 Hedef pazar

**Öncelik sırası:**
1. **KKTC** — beta ve ilk gelir pazarı; turizm yoğun, çok dilli talep yüksek, yerel ödeme avantajı.
2. **Türkiye** — Ekim 2025 Fiyat Etiketi Yönetmeliği ile her masada QR menü **yasal zorunluluk**; devasa zorunlu talep. Ticaret Bakanlığı entegrasyonu satış argümanı.
3. **Turizm dikeyleri** — otel oda servisi, plaj/havuz, bar/gece kulübü, etkinlik/festival.

**Segmentler:** bağımsız kafe/restoran, orta ölçekli zincir (çok şube), otel F&B,
bar, ve etkinlik alanları.

## 1.4 Konumlandırma

Alt uç fiyatla yarışmaz. Ayrışma dört kolonda:

| Kolon | Ne veriyoruz | Rakip durumu |
|---|---|---|
| **AI** | Kişiselleştirme, otomatik upsell, içerik/görsel/video üretimi, otomatik çeviri, menü mühendisliği, chatbot | Yerelde neredeyse yok; globalde parçalı |
| **Reçete & Besin** | Her yemeğin reçetesi → otomatik kalori/makro/alerjen + maliyet + stok düşümü | Piyasada bütünleşik hali yok |
| **Operasyon** | POS/KDS entegrasyonu, garson app, gerçek zamanlı akış | Sadece kurumsal/pahalı sistemlerde |
| **Yerel güç** | KVKK, Tiko/PayTR, çok dilli turizm, Biletcim köprüsü | Global oyuncularda yok |
| **Tüketici portalı (ağ etkisi)** | Konum/şehir/ülke bazlı tüm işletme + menü keşfi, cross-venue hesap, sponsorlu listeleme | Yerel rakiplerde hiç yok — savunulabilir moat |

## 1.5 Haksız avantaj (mevcut ekosistem)

Bu ürün sıfırdan değil; hazır varlıkların üstüne kuruluyor:
- **AI üretim hattı** (Higgsfield / nano_banana_pro / seedance / ElevenLabs) → ürün foto/video/açıklama üretimi doğrudan ürüne gömülü özellik olur.
- **Çok kanallı pazarlama altyapısı** (Brevo + Telsim SMS + WhatsApp Business) → sadakat/kampanya otomasyonu hazır kaldıraç.
- **Yerel ödeme entegrasyon deneyimi** (Tiko + PayTR, Kıbrıs Biletcim'den) → KKTC'de rakiplerin çözemediği kısım.
- **Turizm/etkinlik köprüsü** (Kıbrıs Biletcim, 40K+ MAU) → etkinlik alanı food-court siparişi, biletli müşteriyle eşleşen sipariş akışı.
- **Altyapı deneyimi** (Next.js/Laravel/Hetzner/Reverb) → tekrar kullanılabilir mimari.

## 1.6 İş modeli

**Abonelik (SaaS) + kullanım limitleri.** 4 katman:

| Plan | Kime | İçerik (özet) |
|---|---|---|
| **Free** | Tek şube, görüntüleme | Menü + QR + temel besin gösterimi + sınırlı ziyaret |
| **Pro** | Bağımsız işletme | Sipariş + ödeme + reçete/besin tam + temel AI + analitik |
| **Business** | Çok şube / otel | POS/KDS + sadakat/CRM + gelişmiş AI + çok şube paneli |
| **Enterprise** | Zincir / white-label | Özel entegrasyon, white-label, SLA, Bakanlık entegrasyonu |

Ek gelir kanalları: white-label lisans (Amesis → başka ajanslara B2B2C),
kurulum/onboarding hizmeti, AI içerik üretim paketleri, işlem başına opsiyonel
ödeme geliri (komisyonsuz pozisyonlama korunur — bkz. Orderlina dersi), ve
**tüketici portalında (M20) öne çıkarma / sponsorlu listeleme, premium işletme
rozetleri ve reklam alanları** (ağ büyüdükçe ölçeklenen gelir).

## 1.7 Kuzey yıldızı metrikleri

- Aktif işletme (tenant) sayısı ve churn
- İşletme başına aylık scan → sipariş dönüşüm oranı
- Ortalama sipariş değerindeki (AOV) upsell katkısı
- Reçete/besin modülü aktifleştirme oranı (ayrıştırıcı özellik benimsenmesi)
- Çok şube ve Enterprise'a yükseltme oranı
