# 02 — Özellik Kataloğu (Tam)

Bu, senin özelliklerin + önerilen özellikler + reçete/besin motoru dahil **tam
liste**. Her özellikte faz etiketi var:

- **[MVP]** — v1'de olmalı (must)
- **[V2]** — ticari derinlik
- **[V3]** — ileri/dikey
- **[SÜREKLİ]** — her fazda gelişir

Modül modül:

---

## M1 — Menü & İçerik Yönetimi

- Sınırsız kategori / alt kategori, sıralama, gizleme **[MVP]**
- Ürün: ad, açıklama, fiyat, çoklu görsel, video **[MVP]**
- **Varyasyonlar** (porsiyon, boy) ve **modifier grupları** (ekstra malzeme, pişme derecesi, zorunlu/opsiyonel seçim, min/max) **[MVP]**
- Ürün etiketleri: Yeni, Favori, İndirimli, Şefin Önerisi, Acı, Vejetaryen, Vegan, Glutensiz **[MVP]** (bir kısmı reçeteden otomatik — bkz. M2)
- **Kombo / set menü** kurgusu (otomatik "menü yap" upsell'i) **[V2]**
- **Dayparting** — kahvaltı/öğle/akşam menüsü saate göre otomatik değişir **[V2]**
- Toplu içe aktarma (Excel/CSV) + toplu fiyat güncelleme **[MVP]**
- Çoklu dil içerik (ürün adı/açıklama çeviri tablosu, TR/EN/DE/RU/AR) **[MVP]**
- **AR / 3D menü** — ürünü sipariş öncesi 3D görme **[V3]**

## M2 — Reçete & Besin Değeri Motoru ⭐ (ayrıştırıcı)

> Tam tasarım: `docs/03-recete-besin-modulu.md`

- **Malzeme ana kartı** — her malzeme için 100g/ml besin verisi (kcal, protein, karb, yağ, doymuş yağ, şeker, lif, sodyum), alerjen bayrakları, birim maliyet, birim (g/ml/adet) **[MVP]**
- **Reçete** — ürünü malzemelere miktarla bağlama (ör. 150g dana kıyma + 80g ekmek…) **[MVP]**
- **Otomatik hesap motoru** — porsiyon başına kalori/makro + alerjen listesi otomatik hesaplanır **[MVP]**
- **Menüde gösterim** — kalori rozeti, makro dağılımı, alerjen ikonları, "içerir" uyarıları ürün detayında **[MVP]**
- **Diyet filtreleri** — reçeteden otomatik türetme (vegan/vejetaryen/glutensiz/keto) → müşteri filtreler **[V2]**
- **Maliyet & kâr** — reçete maliyeti → önerilen fiyat/marj, menü mühendisliğine besleme **[V2]**
- **Stok düşümü** — sipariş → reçete → malzeme stoğundan otomatik düşme + düşük stok uyarısı **[V2]**
- **AI besin tahmini** — reçete/malzeme eksikse AI ile tahmini besin doldurma **[V3]**
- **Porsiyon ölçekleme** — reçeteyi X porsiyona ölçekleme (mutfak/üretim) **[V3]**

## M3 — QR & Masa/Alan Yönetimi

- **Dinamik QR** — menü/fiyat değişince QR aynı kalır **[MVP]**
- Tahmin edilemez token'lı, POS-doğrulamalı, markalı QR (spoofing önlemi) **[MVP]**
- Masa / oda / **şezlong** / stant bazlı ayrı QR; sipariş doğru alana bağlanır **[MVP]**
- Masa oturumu (session): oturum boyunca çok turlu sipariş tek açık adisyonda **[MVP]**
- QR tasarım/özelleştirme (logo, renk) + baskı şablonu (stand/sticker) **[MVP]**
- Toplu QR üretimi (çok şube / yüzlerce masa tek panelden) **[V2]**

## M4 — Sipariş & Masa Operasyonu

- Sepet + ürün notu + modifier seçimi **[MVP]**
- **Temassız sipariş** (müşteri telefondan gönderir) **[MVP]**
- **Çok turlu sipariş** (oturum boyunca ekleme) **[MVP]**
- **Canlı sipariş takibi** — "alındı → hazırlanıyor → hazır" (KDS'ten) **[V2]**
- **Garson çağır** / **hesap iste** butonu → garson app bildirimi **[MVP]**
- Açık hesap/adisyon: masa taşıma, birleştirme, bölme **[V2]**
- **Ön sipariş** (gelmeden sipariş / rezervasyonla) **[V3]**

## M5 — Ödeme

- **Soyut `PaymentGateway` arayüzü** — Tiko + PayTR **[MVP]**
- **Masada öde** (tek QR'dan hesabı gör → öde) **[V2]**
- **Hesap bölüşme** — kişi başı / ürün bazlı / eşit **[V2]**
- **Bahşiş** + ödeme sonrası **Google yorum** yönlendirme **[V2]**
- Ödeme sonrası otomatik fiş / e-arşiv / e-fatura (TR) + yerel fatura (KKTC) **[V2]**
- Ödeme verisi tokenize; DB'de plaintext yok, log yok **[MVP]**

## M6 — POS / KDS Entegrasyonu

- **KDS ekranı** (tablet web): sipariş düşme, zamanlayıcı (yeşil→sarı→kırmızı), bump (tamamla) **[MVP]**
- **İstasyon yönlendirme** (order routing): sıcak/soğuk mutfak/bar/tatlı ayrı ekran **[V2]**
- **86 etme** — ürün tükendi → tek dokunuş menüde pasif, QR menüye anında yansır **[MVP]**
- **Sipariş gruplama** (batching) yoğun saatte mutfak verimi **[V2]**
- **Harici POS entegrasyonu** (Simpra, Adisyo vb.) webhook/API push **[V2]**
- Mutfak yazıcı desteği (opsiyonel) **[V2]**
- **Offline dayanıklılık** — internet kesilince sipariş/KDS akışı yerel çalışmaya devam eder, bağlantı gelince senkron **[V2]** *(Menulux boşluğu — bkz. `docs/04` offline-first)*

## M7 — AI Katmanı ⭐

- **Kişiselleştirme** — saat/hava/geçmiş siparişe göre menü sıralama; dönen müşteriye favori öne çıkarma **[V2]**
- **Otomatik upsell** — "yanına patates?", akıllı eşleştirme (AOV +%30 hedefi) **[V2]**
- **Otomatik çeviri** — menüyü TR/EN/DE/RU/AR'a AI ile çevirme **[MVP i18n scaffold / V2 AI çeviri]**
- **AI içerik üretimi** — ürün açıklaması + iştah açıcı metin **[V2]**
- **AI görsel/video üretimi** — Higgsfield hattıyla ürün görseli/tanıtım videosu **[V3]**
- **AI menü mühendisliği** — kârlılık × popülerlik matrisi → "öne çıkar / çıkar" önerisi **[V2]**
- **AI öneri/chatbot** — "vejetaryen ve baharatsız ne var?" menüden cevap **[V3]**
- **AI talep tahmini** — gün/saat/hava → stok & hazırlık önerisi **[V3]**

## M8 — Sadakat / CRM / Pazarlama

- **Sadakat**: puan / dijital damga kartı ("10 al 1 bedava") **[V2]**
- **Kampanya & kupon motoru** (happy hour, kombo, ilk sipariş, dinamik fiyat) **[V2]**
- **Dinamik fiyatlandırma** — saate/güne göre otomatik fiyat (happy hour 16:00) **[V2]**
- **Otomatik pazarlama** (Brevo/Telsim SMS/WhatsApp): doğum günü, geri kazanım, yeni ürün **[V2]**
- **Müşteri veritabanı + segmentasyon** (her scan bir profil) **[V2]**
- **Google yorum toplama** otomasyonu **[V2]**

## M9 — Analitik & Raporlama

- Temel: scan, görüntülenme, sipariş, ciro **[MVP]**
- **Ürün ısı haritası** (kaç bakış, nerede terk) **[V2]**
- **Kârlılık raporları** (reçete maliyetiyle) masa/saat/personel bazlı **[V2]**
- **Menü performansı** (yıldız/at ürünü) **[V2]**
- Gerçek zamanlı gösterge paneli **[V2]**
- **Patron mobil rapor app'i** (Boss App muadili) — ciro/kasa/stok/en çok satan, anlık, mobilden **[V2]** *(Menulux boşluğu)*

## M10 — Garson / Personel App (React Native + Expo)

- Anlık bildirim: garson çağrısı, hazır sipariş (KDS bump), hesap talebi **[MVP]**
- **Masa durum panosu** (dolu/boş/ödeme bekliyor) **[MVP]**
- Sipariş görüntüleme + durum güncelleme **[MVP]**
- Manuel sipariş girişi (garson elle ekler) **[V2]**
- Bahşiş havuzu + vardiya **[V3]**
- **Personel yönetimi** — mesai/giriş-çıkış, performans, yetki **[V3]** *(Menulux boşluğu)*
- **Kurye sipariş/takip app'i** — kendi teslimat yapan işletme için paket dağıtım + konum takibi **[V3]** *(Menulux boşluğu)*

## M11 — Müşteri Arayüzü

- **PWA** (uygulama indirmeden QR ile erişim) — çekirdek **[MVP]**
- Hızlı yükleme (<2sn), kategori arama, dil seçimi **[MVP]**
- Sipariş geçmişi, tek dokunuş tekrar sipariş **[V2]**
- **Opsiyonel native müşteri app** (sadakat/tekrar sipariş, FCM push) **[V3]**
- **Tüketici uygulaması & keşif portalı** (native + web) — masadaki QR erişimine ek olarak konum/şehir/ülke bazlı tüm işletmeleri keşfetme; detay: **M20** **[V2 web / V3 native]**
- **Tablet menü modu** — masada iPad/tablet premium menü deneyimi (aynı menü altyapısı) **[V2]** *(Menulux boşluğu)*
- **Kasa müşteri ekranı (customer display)** — kasada müşteriye sipariş/tutar gösteren ikinci ekran **[V3]** *(Menulux boşluğu)*

## M12 — Multi-tenant SaaS & Yönetim

- **Multi-tenancy** (`tenant_id`, subdomain/custom domain) **[MVP]**
- **Self-servis onboarding** (kayıt → dakikalar içinde canlı) **[MVP]**
- **Rol bazlı yetki** (owner/manager/waiter/kitchen/superadmin) **[MVP]**
- **Plan/paket + kullanım limiti** yönetimi (Free/Pro/Business/Enterprise) **[MVP]**
- **Çok şube** merkezî panel (tek panelden tüm şubeler) **[V2]**
- **Superadmin** paneli (tenant yönetimi, impersonation, audit log, 2FA) **[V2]**
- **White-label** (kendi marka/domain ile satış) **[V3]**
- Faturalama/abonelik yönetimi + otomatik tahsilat **[V2]**

## M13 — Turizm & Sektörel Dikeyler

- **Otel oda servisi modu** — oda bazlı QR, oda hesabına yazma **[V3]**
- **Plaj/havuz servisi** — şezlong numarasına sipariş **[V3]**
- **Bar/gece kulübü modu** — yüksek hacim, tek dokunuş tekrar sipariş **[V3]**
- **Etkinlik/festival modu** — food-court siparişi + **Kıbrıs Biletcim** biletli müşteri eşleşmesi **[V3]**

## M14 — Entegrasyonlar

- Ödeme: Tiko, PayTR **[MVP]**
- Bildirim: FCM, Brevo, Telsim SMS, WhatsApp Business API **[MVP push+e-posta / V2 SMS+WA]**
- Harici POS (Simpra/Adisyo) **[V2]**
- **Yazarkasa / ÖKC (mali onaylı ödeme)** — TR yasal zorunluluk; Beko/Ingenico/Pavo/Verifone/Hugin ÖKC cihazları **[V2]** *(Menulux boşluğu — TR için kritik)*
- **ERP / muhasebe konnektörleri** — Logo, Mikro, Netsis, Uyumsoft (opsiyonel SAP) **[V2]** *(Menulux boşluğu)*
- **Yemek teslim platformları** — Yemeksepeti/Trendyol Yemek/Getir/Migros/Fuudy tek panelde toplama (tablet mezarlığını bitir) **[V2]** *(V3'ten öne çekildi)*
- **Kurye entegrasyonları** — Fiyuu / Maxijett / Paket Taxi **[V3]** *(Menulux boşluğu)*
- Muhasebe / e-fatura / e-arşiv / Ticaret Bakanlığı (TR) **[V2]**
- Rezervasyon sistemi **[V3]**

## M15 — Uyumluluk & Güvenlik **[SÜREKLİ]**

- **KVKK** — kişisel veri minimizasyonu, şifreleme, silme/anonimleştirme, çerez/rıza altyapısı
- Alerjen zorunlu gösterim (EU/turist pazarı)
- Rate limiting, rol bazlı yetki, audit log
- Ödeme PCI-dışı tasarım (tokenizasyon/redirect)
- POS-doğrulamalı QR (spoofing önlemi)

## M16 — Self-Order Kiosk *(Menulux boşluğu)*

- **Kiosk modu** — kasada/girişte tam ekran dokunmatik self-sipariş (aynı menü + sipariş + ödeme altyapısı) **[V2]**
- Sıra beklemeden sipariş + kiosk üzerinden ödeme + KDS'e düşme **[V2]**
- Kiosk-özel upsell ekranları (combo/ekstra) **[V2]**
- Erişilebilirlik + çoklu dil + inaktivite sıfırlama **[V2]**

## M17 — Dijital Menuboard / Signage *(Menulux boşluğu)*

- **Duvar ekranı menü** — menü/fiyat/kampanya ekranlarda otomatik döner **[V2]**
- Dayparting ile ekran içeriği saate göre değişir (kahvaltı/öğle/akşam) **[V2]**
- **AI video/görsel** ile kampanya içeriği (Higgsfield hattı — bizde hazır avantaj) **[V3]**
- Çoklu ekran / çoklu şube tek panelden yönetim **[V2]**

## M18 — Envanter / Stok Yönetimi *(Menulux boşluğu — M2 reçete üstüne)*

- **Malzeme stoğu** — reçeteden otomatik düşüm + düşük stok uyarısı **[V2]** (M2 ile bağlı)
- **Tedarikçi + satın alma emri (PO)** — sipariş, teslim alma, maliyet güncelleme **[V3]**
- **Sayım / fire / transfer** — dönemsel sayım, fire kaydı, şubeler arası transfer **[V3]**
- **Maliyet & teorik-fiili fark** — reçete maliyeti vs gerçek tüketim **[V3]**

## M19 — Kendi POS / Adisyon Terminali *(stratejik — Menulux'ün çekirdeği)*

> **Strateji:** v1-v2'de QR/sipariş + KDS + harici POS entegrasyonu ile git; kendi tam
> POS/adisyon terminalini **v3 stratejik hedef** olarak kur. Böylece Menulux'le kafa
> kafaya rekabet için kapı açık kalır ama MVP kapsamı şişmez.

- Kasa/adisyon terminali (masa açma, adisyon bölme, taşıma/birleştirme) **[V3]**
- Personel/vardiya + kasa devir + z-raporu **[V3]**
- **Offline-first** (yerel DB + senkron) — POS için şart **[V3]** (bkz. `docs/04`)
- Yazarkasa/ÖKC + mali fiş entegrasyonu **[V3]** (M14)
- Robot/runner entegrasyonu — ileri/opsiyonel **[V3+]**

## M20 — Tüketici Portalı & Keşif (Marketplace) ⭐ *(stratejik moat — hiçbir yerel rakipte yok)*

> **Strateji:** ComiQR'ın kurulu işletme tabanı = hazır içerik. Bunun üzerine tüketici
> tarafını (app + web) koyarak ürün **tek yönlü B2B SaaS'tan iki taraflı pazara (B2B2C
> marketplace)** dönüşür. İşletmeler tüketici çeker, tüketici trafiği yeni işletme çeker
> (ağ etkisi). Bu, savunulabilir en büyük farklılaştırıcıdır.

- **Tüketici uygulaması (native iOS/Android) + web portalı** — tek marka altında tüm ComiQR işletmeleri **[V2 web / V3 native]**
- **Dizin & keşif** — tüm işletmeler **ülke / şehir / bölge / konum** bazlı listelenir **[V2]**
- **Kategori** — restoran, kafe, bar, gece kulübü, otel, plaj kulübü, pastane, fast-food, fine-dining vb. **[V2]**
- **Yakınımdaki + harita görünümü** — geolokasyon, mesafe sıralama, harita üzerinde işletmeler **[V2]**
- **Gelişmiş arama & filtre** — mutfak türü, fiyat aralığı, **şu an açık**, puan, özellik etiketleri (deniz manzarası, açık alan, canlı müzik, evcil dostu, WiFi, otopark) **[V2]**
- **Diyet filtresi** — vegan / glutensiz / helal menüsü olan işletmeler (M2 reçete-besin verisinden beslenir) **[V2]** *(rakiplerde imkânsız)*
- **İşletme public profil sayfası** — foto galeri, çalışma saatleri, konum/harita, iletişim, sosyal linkler, kampanyalar **[V2]**
- **Canlı menü** — işletmenin gerçek ComiQR menüsü (fiyat, görsel, kalori/alerjen) portalda görünür **[V2]**
- **Sipariş / rezervasyon köprüsü** — işletme açıksa portaldan sipariş veya rezervasyon başlatma **[V3]**
- **Tüketici hesabı (cross-venue)** — tek hesap, tüm işletmelerde sipariş geçmişi + sadakat + favoriler **[V3]**
- **Favoriler & takip** — favori işletme kaydı, kampanya/yeni menü bildirimi (FCM) **[V3]**
- **Puan & yorum** — işletme değerlendirme, doğrulanmış sipariş yorumu **[V3]**
- **SEO keşfedilebilirlik** — her işletme + "şehir × kategori" sayfaları SEO-dostu; Google'dan organik trafik işletmeye akar **[V2]**
- **Turizm modu / şehir rehberi** — turist için editoryal listeler ("Girne'de en iyi 10 sahil restoranı"), çok dilli **[V3]**
- **Etkinlik keşfi** — **Kıbrıs Biletcim** köprüsüyle etkinlik mekânları/festival food-court listeleme **[V3]**
- **Gelir modeli:** öne çıkarma / **sponsorlu listeleme**, premium işletme rozetleri, reklam alanları — ek gelir kanalı **[V3]**

---

## Faz özeti (kabaca)

- **MVP** = M1 çekirdek, **M2 çekirdek (reçete/besin)**, M3, M4 çekirdek, M5 temel, M6 temel (KDS+86), M10 temel, M11 PWA, M12 temel, M15
- **V2** = M4 tam, M5 tam, M6 tam **+ offline**, M7 çekirdek AI, M8 tam, M9 tam **+ patron app**, M11 tablet menü, M12 çok şube+superadmin, **M14 yazarkasa+ERP+delivery**, **M16 kiosk**, **M17 menuboard**, **M18 stok**, **M20 keşif portalı (web)**
- **V3** = M7 ileri AI, M10 personel+kurye, M11 native+customer display, M12 white-label, M13 dikeyler, M14 kurye/rezervasyon, M17 AI signage, M18 tam envanter, **M19 kendi POS**, **M20 native app + cross-venue hesap + sponsorlu listeleme**, M1 AR

> **Menulux boşluk kapatma özeti:** kritik dört (offline, yazarkasa/ÖKC, ERP, delivery+kurye)
> V2'ye; kiosk/menuboard/stok V2-V3; kendi POS v3 stratejik. Detay: `docs/08-rakip-bosluk-analizi.md`.
