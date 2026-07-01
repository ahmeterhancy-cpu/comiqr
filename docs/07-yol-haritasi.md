# 07 — Yol Haritası (MVP → V2 → V3)

Efor kabaca: **S** ≤3g, **M** ~1 hafta, **L** ~2 hafta, **XL** ~3+ hafta (tek geliştirici referansı; ekip küçültür).

---

## Faz 0 — Temel altyapı  (≈2 hafta)

| İş | Efor |
|---|---|
| Monorepo + Laravel 13 + Next.js 16 scaffolding + CI + `deploy.sh` | M |
| Redis, Horizon, Reverb, R2 bağlantıları | M |
| Multi-tenancy (BelongsToTenant trait + global scope + TenantResolver) | L |
| Auth + Sanctum + rol/policy | M |
| Self-servis onboarding (kayıt → subdomain → seed) | M |

**Çıkış kriteri:** yeni işletme kayıt olup boş panele girebiliyor; tenant izolasyonu testli.

---

## Faz 1 — MVP  (≈6-7 hafta) → ilk canlı işletme

| Modül | İş | Efor |
|---|---|---|
| M1 Menü | Kategori/ürün/varyasyon/modifier/medya/etiket + i18n içerik + Excel import | L |
| **M2 Reçete/Besin** | Malzeme kartı + reçete + hesap motoru (testli) + menüde gösterim + aç/kapat | **L** |
| M3 QR/Masa | Dinamik QR token + masa/oda/şezlong + oturum + baskı şablonu | M |
| M4 Sipariş | PWA menü + sepet + temel sipariş + çok tur + garson çağır/hesap iste | L |
| M5 Ödeme | `PaymentGateway` + tek geçit (PayTR veya Tiko) temel akış | M |
| M6 KDS | KDS ekranı (sipariş düşme, durum, bump) + 86 → menüye yansıma | M |
| M10 Garson | Expo app: masa panosu + bildirim (Reverb/FCM) + durum güncelle | L |
| M11 Müşteri | PWA, hız, dil seçimi, offline shell | M |
| M9 Analitik | Temel (scan/görüntülenme/sipariş/ciro) | S |
| M12 SaaS | Plan/limit + rol + temel superadmin | M |
| M15 Uyum | KVKK temel (rıza/çerez/veri minimizasyonu) + QR güvenliği | M |

**MVP kabul:** Bir restoran kaydolur → menü + reçete/besin girer → QR basar →
müşteri telefondan menüyü görür (kalori/alerjen dahil) → sipariş verir → KDS'e
düşer → garson yönetir → ödeme alınır. Reçete/besin motoru **tam** çalışır.

---

## Faz 2 — Ticari derinlik  (≈8-10 hafta)

| Alan | İş |
|---|---|
| M4/M5 | Tam scan-order-pay, **hesap bölüşme**, masada öde, bahşiş, e-fatura |
| M6/M14 | İstasyon yönlendirme, batching, **harici POS** (Simpra/Adisyo) entegrasyonu |
| M2 | Stok düşümü + düşük stok uyarısı + malzeme kütüphanesi + maliyet/menü mühendisliği bağı |
| M7 | **AI kişiselleştirme + otomatik upsell** + AI çeviri + AI ürün açıklaması + menü mühendisliği insight |
| M8 | Sadakat/puan/damga + kupon + **dinamik fiyat** + Brevo/SMS/WhatsApp otomasyon + segmentasyon + Google yorum |
| M9 | Isı haritası + kârlılık + menü performansı + gerçek zamanlı panel + **patron mobil rapor app'i** |
| M12 | **Çok şube** merkezî panel + superadmin (impersonation/audit/2FA) + faturalama |
| M1/M11 | Kombo/set menü + dayparting + **tablet menü modu** |
| **Menulux boşluk (kritik)** | **Offline dayanıklılık** (sipariş kuyruklama, garson/KDS offline) · **Yazarkasa/ÖKC** mali fiş · **ERP konnektörleri** (Logo/Mikro/Netsis/Uyumsoft) · **Delivery platform toplama** (Yemeksepeti/Getir/Trendyol/Migros/Fuudy) |
| **Menulux boşluk (ürün)** | **M16 Self-Order Kiosk** · **M17 Dijital Menuboard/Signage** · **M18 stok/envanter** (tedarikçi/PO/sayım) |
| **M20 Tüketici portalı (web)** | Keşif/dizin (ülke/şehir/konum/kategori) · arama & filtre (mutfak/fiyat/açık/puan/diyet) · yakınımdaki + harita · **işletme public profil sayfası + canlı menü** · SEO "şehir × kategori" landing'leri · kampanya gösterimi |

**V2 kabul:** çok şubeli bir işletme sipariş+ödeme+sadakat+AI upsell'i uçtan uca
kullanıyor; POS/KDS entegre; pazarlama otomasyonu çalışıyor; **internet kesintisinde
sipariş akışı durmuyor; TR'de mali fiş kesiliyor; kiosk + menuboard canlı; tüketici
portalı web'de yayında, işletmeler harita/şehir bazlı keşfediliyor.**

---

## Faz 3 — AI ileri, dikeyler, white-label  (≈8-12 hafta)

| Alan | İş |
|---|---|
| M7 | AI görsel/video üretimi (Higgsfield hattı) + chatbot + talep tahmini + AI besin tahmini |
| M1 | AR / 3D menü |
| M11 | Native müşteri app (Expo) + FCM + tekrar sipariş + sadakat |
| **M20 Tüketici portalı (native + ağ)** | Native keşif app (iOS/Android) · **cross-venue tüketici hesabı** (tüm işletmelerde sipariş geçmişi + favoriler) · puan/yorum · sipariş/rezervasyon köprüsü · turizm modu/şehir rehberi · **sponsorlu listeleme/öne çıkarma (gelir)** |
| M12 | **White-label** (marka/domain) — Amesis B2B2C satış |
| M13 | **Dikeyler**: otel oda servisi, plaj/şezlong, bar modu, **etkinlik + Kıbrıs Biletcim köprüsü** |
| M14 | Yemek teslim + rezervasyon + Bakanlık entegrasyonu (TR) |
| **Menulux boşluk (v3)** | **M19 kendi POS/adisyon terminali** (offline-first, adisyon bölme, z-raporu) · **kurye app + entegrasyonları** (Fiyuu/Maxijett/Paket Taxi) · **tam envanter** (fire/transfer/teorik-fiili) · **personel yönetimi** · customer display · AI signage içerik · robot/runner entegrasyonu (opsiyonel) |

**V3 kabul:** turizm dikeyleri canlı; white-label ile ikinci bir marka satılabiliyor;
AI içerik üretimi ve dikey senaryolar ürün içinde; **isteğe bağlı kendi POS'u ile
Menulux'le kafa kafaya rekabet mümkün.**

---

## Riskler & kritik notlar

- **Reçete/besin veri girişi sürtünmesi** en büyük benimsenme riski → malzeme kütüphanesi + AI tahmini + Excel import erken önceliklendir.
- **Meta/Bakanlık/jurisdiction**: KKTC iş ver(doğrulama) sorunları TR entegrasyonlarında çıkabilir; ödeme/fatura tarafını erken test et.
- **Higgsfield job zamanlaması** (~50sn görsel→video, CloudFront manuel upload) async job'ta net işaretlensin.
- **Performans**: public menü cache + `nutrition_summaries` türetilmiş tablo olmadan hesap canlı yapılmamalı.
- **Kapsam disiplini**: her fazın kabul kriteri karşılanmadan sonrakine geçme.

---

## Claude Code'a ilk komut önerisi

> "`CLAUDE.md` ve `docs/07`'yi oku. Faz 0'ı uygula: monorepo scaffolding, Laravel
> 11 + Next.js uygulamaları, multi-tenancy (BelongsToTenant + global scope +
> TenantResolver) ve self-servis onboarding. `docs/04` mimarisine ve `docs/05`
> şemasına uy. Tenancy izolasyonu için Pest feature testleri yaz. Bitince Faz
> 1'de menü modülü + reçete/besin motoruna (`docs/03`) geçeceğiz."
