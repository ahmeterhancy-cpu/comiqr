# CLAUDE.md — ComiQR Geliştirme Talimatları

> Bu dosya Claude Code'un ilk okuyacağı dosyadır. Projenin ne olduğunu, nasıl
> çalışılacağını ve hangi sırayla geliştirileceğini tanımlar. Her yeni oturumda
> önce bu dosyayı, sonra `docs/` altındaki ilgili spec'i oku.

---

## 0. Kod adı / marka notu

**ComiQR** bir ÇALIŞMA KOD ADIDIR (placeholder). Nihai marka adı henüz kesin
değil. Kod içinde marka adını sabit yazma; `APP_NAME` env değişkeni ve i18n
üzerinden çek. Böylece rebrand tek noktadan yapılır.

---

## 1. Ürün tek cümlede

ComiQR; restoran, kafe, bar, otel ve turizm işletmeleri için **çok kiracılı
(multi-tenant) SaaS** bir gelişmiş QR menü + sipariş + operasyon platformudur.
Üstüne, tüm işletmeleri konum/şehir/ülke bazlı keşfettiren bir **tüketici portalı
(app + web, marketplace)** ile iki taraflı bir ağa dönüşür.
Hedef pazar önceliği: **KKTC → Türkiye → turizm dikeyleri (otel/plaj/etkinlik)**.

Ayrıştığımız kolonlar (rakiplerin en fazla birini yapıyor):
1. **AI** — kişiselleştirme, otomatik upsell, içerik/görsel/video üretimi, çeviri, menü mühendisliği
2. **Reçete & Besin Değeri Motoru** — her yemeğin reçetesi işlenir; kalori/makro/alerjen otomatik hesaplanıp menüde gösterilir, maliyet ve stok buna bağlanır
3. **Derin operasyon** — POS/KDS entegrasyonu, garson app, gerçek zamanlı sipariş akışı
4. **Yerel güç** — KVKK uyumu, yerel ödeme (Tiko/PayTR), çok dilli turizm, Kıbrıs Biletcim köprüsü
5. **Tüketici portalı (ağ etkisi)** — konum/şehir/ülke bazlı tüm işletme + menü keşfi, cross-venue hesap, sponsorlu listeleme (M20 — yerel rakiplerde yok)

Detay için: `docs/01-urun-vizyonu.md`

---

## 2. Teknoloji yığını (kesin — sapma yok)

> Altyapı kararları ve gerekçeleri: `docs/00-altyapi-kararlari.md` (ADR). Sürümler
> bilinçli olarak güncellendi: Next 14 EOL oldu (Eki 2025) → **Next 16**; Laravel 11
> yaşlandı, native AI SDK için → **Laravel 13**.

| Katman | Teknoloji |
|---|---|
| Müşteri arayüzü (QR) | **Next.js 16** App Router (React 19, Turbopack), **PWA**, Tailwind, next-intl (TR/EN/DE/RU/AR) |
| Yönetim paneli | **Next.js 16** App Router, Tailwind, shadcn/ui |
| KDS | **Next.js 16** (tablet tarayıcı, tam ekran) + Reverb |
| Backend API | **Laravel 13** (PHP 8.3), REST + **Sanctum** token auth, **Laravel AI SDK** |
| Veritabanı | **PostgreSQL 16+** (satır bazlı multi-tenancy `tenant_id`, **pgvector** AI için) |
| DB barındırma | **Neon (Frankfurt, pgBouncer havuzlu)** — managed; ileride Hetzner'a taşınabilir |
| Cache / Queue / Session | **Redis (Upstash)** + Laravel Horizon |
| Gerçek zamanlı | **Laravel Reverb** (Hetzner self-host, Redis pub/sub ile ölçek) |
| Dosya/medya | **Cloudflare R2** (S3 uyumlu) |
| Ödeme | **Tiko + PayTR** (soyut `PaymentGateway` arayüzü) |
| Push / E-posta / SMS / WhatsApp | FCM · Brevo · Telsim SMS · WhatsApp Business API |
| AI | **Anthropic** (Laravel AI SDK ile metin/insight/chatbot/çeviri) · Higgsfield (görsel/video) · ElevenLabs (ops. ses) |
| Garson app | **React Native + Expo (SDK 54+)** |
| Runtime | **Node 22 LTS** · **PHP 8.3** |
| Monorepo | **Turborepo + pnpm** |
| Barındırma | **Hepsi Hetzner VPS (Frankfurt)** — Laravel API + Reverb (Nginx + PHP-FPM + Supervisor) + 3 Next uygulaması (PM2/Node). Önünde **Cloudflare**: CDN + SSL + **Cloudflare for SaaS** (per-tenant custom hostname / white-label). DB → **Neon** · Redis → **Upstash** |
| CI/Deploy | GitHub Actions → test → `deploy.sh` (Hetzner: migrate, build, PM2/Supervisor restart) |

**Neden müşteri tarafı PWA (native değil) — masa deneyiminde:** QR menünün tüm değer
önermesi "uygulama indirmeden erişim". Müşteri masada PWA'ya QR'dan girer. Buna **ek
olarak**, tüm işletmeleri keşfettiren **tüketici portalı web'de (V2)** ve **native app'te
(V3)** gelir — bu, tekil QR erişiminden farklı, ağ/keşif ürünüdür (bkz. `docs/02` M20).

---

## 3. Repo yapısı (monorepo)

```
comiqr/
├── CLAUDE.md                  # bu dosya
├── docs/                      # tüm spec'ler (numaralı)
├── apps/
│   ├── api/                   # Laravel 13 backend
│   ├── web-customer/          # Next.js müşteri PWA (QR menü)
│   ├── web-portal/            # Next.js tüketici keşif portalı (marketplace, SEO/SSG) — M20
│   ├── web-admin/             # Next.js yönetim paneli
│   ├── web-kds/               # Next.js KDS ekranı
│   └── mobile-waiter/         # React Native + Expo garson app
├── packages/
│   ├── shared-types/          # ortak TS tipleri (API sözleşmesi)
│   └── ui/                    # ortak React bileşenleri
└── infra/                     # nginx, deploy.sh, docker-compose (dev)
```

---

## 4. Çalışma kuralları (Claude Code için)

### Genel
- **Türkçe konuş**, ama tüm kod tanımlayıcıları (değişken, tablo, endpoint, commit) **İngilizce**.
- Kapsam daraltma yapma. Bir modül istendiğinde eksiksiz üret; iskeleti bırakıp geçme.
- Her önemli kararı `docs/` içindeki ilgili spec'e dayandır. Spec ile çelişki görürsen dur ve sor.
- Büyük dosyaları böl; 400 satırı geçen bileşen/controller'ı refactor et.

### Multi-tenancy (KRİTİK)
- Her tenant'a ait tabloda `tenant_id` bulunur ve **global scope** ile otomatik filtrelenir.
- Hiçbir sorgu `tenant_id` olmadan tenant verisine dokunamaz. Bunu Eloquent global scope + middleware ile zorunlu kıl.
- Tenant çözümlemesi: subdomain (`isletme.comiqr.com`) veya custom domain → `TenantResolver` middleware.
- Superadmin hariç hiçbir kullanıcı başka tenant verisini göremez.

### Güvenlik & KVKK
- Kişisel veri (müşteri telefon/e-posta) şifreli saklanır, minimum tutulur, silme/anonimleştirme desteklenir.
- QR linkleri POS-doğrulamalı, tahmin edilemez token içerir (spoofing önlemi).
- Ödeme verisi asla loglanmaz, asla DB'de plaintext tutulmaz. PCI dışı kalmak için tokenizasyon (PayTR/Tiko iframe/redirect).
- Tüm endpoint'ler rate-limit'li. Rol bazlı yetki (owner/manager/waiter/kitchen/superadmin).

### i18n
- Backend'de ürün adı/açıklaması gibi içerikler **çeviri tablosu** ile (bkz. `docs/05-veritabani-semasi.md`).
- Frontend UI metinleri next-intl JSON. Varsayılan dil TR; fallback zinciri TR→EN.

### Gerçek zamanlı
- Yeni sipariş / durum değişikliği / garson çağrısı → Reverb kanalına yayınla.
- Kanallar tenant + branch ile izole (`private-branch.{id}.orders`).

### Test
- Backend: Pest ile feature testleri (özellikle tenancy izolasyonu ve reçete besin hesabı için zorunlu).
- Kritik para/besin/stok hesapları için birim testi olmadan merge yok.

---

## 5. Geliştirme sırası (build order)

Bu sırayı takip et. Detaylı faz kapsamı: `docs/07-yol-haritasi.md`.

**Faz 0 — Temel (hafta 1-2)**
1. Monorepo + Laravel + Next scaffolding, CI, R2, Redis, Reverb bağlantıları
2. Auth + multi-tenancy iskeleti + rol/yetki
3. Tenant onboarding (self-servis kayıt → subdomain)

**Faz 1 — MVP (hafta 3-8)**
4. Menü modülü (kategori, ürün, varyasyon, modifier, medya, etiket, dayparting)
5. **Reçete & Besin Değeri Motoru** (malzeme, reçete, otomatik hesap, menüde gösterim) — bkz. `docs/03-recete-besin-modulu.md`
6. QR & masa yönetimi (dinamik QR token, masa/oda/şezlong)
7. Müşteri PWA menü görüntüleme + sepet + temel sipariş
8. Garson app temel (sipariş görme, masa durumu, çağrı bildirimi)
9. KDS ekranı temel (sipariş düşme, bump, 86)
10. Yönetim paneli + temel analitik + KVKK + tek ödeme geçidi

**Faz 2 — Ticari derinlik**: bkz. yol haritası
**Faz 3 — AI & dikeyler & white-label**: bkz. yol haritası

---

## 6. Spec haritası

| Dosya | İçerik |
|---|---|
| `docs/01-urun-vizyonu.md` | Vizyon, pazar, konumlandırma, haksız avantaj, iş modeli |
| `docs/02-ozellik-kataloğu.md` | TÜM özellikler modül modül + faz etiketi (MoSCoW) |
| `docs/03-recete-besin-modulu.md` | Reçete & besin değeri motoru — derin tasarım |
| `docs/04-teknik-mimari.md` | Mimari, akışlar, entegrasyonlar, güvenlik |
| `docs/05-veritabani-semasi.md` | Tam DB şeması (tablolar + ilişkiler) |
| `docs/06-api-spec.md` | REST API endpoint sözleşmesi |
| `docs/07-yol-haritasi.md` | MVP → v2 → v3 faz planı + efor |
| `docs/08-rakip-bosluk-analizi.md` | Menulux boşluk analizi + kapatma planı |

Başlarken: `docs/01` → `docs/02` → `docs/07` (faz) → ilgili teknik spec.
