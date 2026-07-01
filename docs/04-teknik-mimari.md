# 04 — Teknik Mimari

## 4.1 Yüksek seviye

```
                     ┌─────────────────────────────────────────┐
   Müşteri telefonu  │  web-customer (Next.js PWA)             │
   (QR tarar) ─────► │  isletme.comiqr.com / custom domain    │
                     └───────────────┬─────────────────────────┘
                                     │ REST (Sanctum token, public menu = token'lı QR)
 ┌───────────────┐   ┌───────────────▼─────────────────────────┐
 │ web-admin     │──►│           api (Laravel 13)               │
 │ (Next.js)     │   │  Controllers · Services · Jobs (Horizon) │
 └───────────────┘   │  Multi-tenancy (tenant_id global scope)  │
 ┌───────────────┐   │  PaymentGateway · AI · Nutrition engine  │
 │ web-kds       │◄─►│                                          │
 │ (tablet)      │   └──┬───────────┬──────────┬────────────────┘
 └───────────────┘      │           │          │
 ┌───────────────┐      ▼           ▼          ▼
 │ mobile-waiter │   Postgres     Redis     Laravel Reverb (WS)
 │ (Expo, FCM)   │◄────────────  (cache/    (siparis→KDS/garson,
 └───────────────┘   Cloudflare  queue/     canlı durum)
                     R2 (medya)  session)
        Harici: Tiko/PayTR · Brevo · Telsim SMS · WhatsApp · FCM · Anthropic · Higgsfield
```

## 4.2 Multi-tenancy

- **Model:** tek DB (PostgreSQL), satır bazlı izolasyon (`tenant_id` her ilgili tabloda).
- **Çözümleme:** `TenantResolver` middleware subdomain/custom domain → `tenant_id` set eder, container'a bağlar.
- **Zorlama:** `BelongsToTenant` trait + Eloquent **global scope** → tüm sorgular otomatik `tenant_id` ile filtrelenir. Yazımda `tenant_id` otomatik doldurulur.
- **Superadmin:** ayrı guard; scope bypass sadece `superadmin` yetkisiyle, audit log ile.
- (Ölçek büyürse `stancl/tenancy` ile DB-per-tenant'a geçiş kapısı açık bırakılır — ama v1 tek DB.)

## 4.3 Kimlik & yetki

- **İşletme kullanıcıları:** Sanctum token. Roller: `owner`, `manager`, `waiter`, `kitchen`. Rol → izin (policy) haritası.
- **Müşteri:** QR token ile anonim oturum; sipariş/ödeme için opsiyonel hafif kimlik (telefon OTP) — sadakat isteğe bağlı.
- **Superadmin:** ayrı panel, zorunlu 2FA, IP whitelist, audit log.

## 4.4 Gerçek zamanlı akış (Reverb)

Kanallar (tenant + branch izole):
- `private-branch.{branchId}.orders` — yeni sipariş, durum değişimi
- `private-branch.{branchId}.waiter` — garson çağrısı, hesap talebi
- `private-branch.{branchId}.kds.{station}` — istasyon bazlı sipariş
- `private-table.{tableSessionId}` — müşteriye canlı durum ("hazırlanıyor→hazır")

Olay örnekleri: `OrderPlaced`, `OrderItemStatusChanged`, `WaiterCalled`,
`BillRequested`, `ItemEightySixed`.

## 4.5 Sipariş yaşam döngüsü

```
müşteri sepet → OrderPlaced
  → api: masa oturumuna bağla, stok kontrol, KDS istasyonlarına routing
  → Reverb: KDS + garson bildirimi
  → mutfak: item durum güncelle (accepted→preparing→ready) → Reverb müşteriye
  → garson: teslim → served
  → ödeme: pay-at-table / garson / kasa → Payment → e-fatura
  → session kapanış → analitik + sadakat puanı + yorum daveti
```

Durumlar: `pending, accepted, preparing, ready, served, cancelled`.
Ödeme: `unpaid, partially_paid, paid, refunded`.

## 4.6 Ödeme mimarisi

- `PaymentGateway` arayüzü: `initiate(order): PaymentSession`, `handleWebhook(payload)`, `refund()`.
- Uygulamalar: `TikoGateway`, `PayTRGateway`. Yeni geçit = yeni sınıf.
- **PCI dışı kal:** kart verisi bize hiç gelmez (iframe/redirect/tokenizasyon). Webhook imza doğrulaması zorunlu.
- Hesap bölüşme: bir `order` altında çoklu `payment` (kişi/pay bazlı).

## 4.7 AI mimarisi

- `AiService` soyutlaması → sağlayıcı bağımsız.
- Görevler: `TranslateMenu`, `GenerateProductCopy`, `MenuEngineeringInsight`, `PersonalizeMenu`, `NutritionEstimate`, `ChatAssistant`.
- Metin: Anthropic API. Görsel/video: Higgsfield hattı (async job; ~50sn görsel→video bekleme kuralına dikkat; CloudFront upload manuel adımı job'ta işaretle).
- Tüm AI çağrıları queue'da; sonuç cache'lenir; maliyet için tenant plan limiti.

## 4.8 Altyapı & dağıtım

> Karar detayları: `docs/00-altyapi-kararlari.md`. Özet: **lean Hetzner + Cloudflare** (Vercel değil), **PostgreSQL/Neon** (MySQL değil).
- **Hetzner VPS (Frankfurt):** Laravel API (Nginx + PHP-FPM) + Reverb + Horizon (Supervisor) + 3 Next uygulaması (PM2/Node).
- **Cloudflare:** CDN + SSL + **Cloudflare for SaaS** (per-tenant custom hostname / white-label) tüm origin'lerin önünde.
- **Neon (Frankfurt):** managed PostgreSQL (pgBouncer havuzlu, pgvector). **Upstash:** Redis.
- **R2:** medya (ürün foto/video, QR görselleri).
- **CI/CD:** GitHub Actions → test → `deploy.sh` (migrate, build, PM2/Supervisor restart).
- **Yedek:** Neon otomatik yedek/branch + R2 versiyonlama. Reverb/Horizon health check.

## 4.9 Güvenlik & KVKK (özet — M15)

- Kişisel veri minimizasyonu + at-rest şifreleme (telefon/e-posta).
- Silme/anonimleştirme uçları (KVKK talep akışı).
- Rate limiting (public menü + sipariş uçları agresif).
- Audit log (superadmin + kritik işlemler).
- Rıza/çerez altyapısı (turist = çoklu dil rıza metni).
- QR token'ları imzalı ve süreli; masa oturumu bittiğinde geçersiz.

## 4.10 Performans hedefleri

- Public menü ilk açılış < 2sn (statik/edge cache + `nutrition_summaries` cache).
- Menü verisi CDN + `Cache-Control`; fiyat/86 değişiminde targeted invalidation.
- KDS/garson gecikmesi < 1sn (Reverb).

## 4.11 Offline dayanıklılık (offline-first) *(Menulux boşluğu)*

Restoranda internet düşünce sipariş/ödeme durmamalı. Katmanlı yaklaşım:

- **Müşteri PWA:** service worker ile menü + `nutrition_summaries` cache'lenir; internet
  yokken menü görüntülenir. Sipariş, bağlantı gelince gönderilmek üzere IndexedDB'de
  kuyruklanır (idempotency key ile çift gönderim önlenir).
- **Garson app (Expo):** yerel SQLite; masa/sipariş yerelde çalışır, `outbox` deseniyle
  senkron. Bağlantı gelince sıra ile sunucuya push, sunucu olayları çekilir.
- **KDS:** son sipariş durumları yerelde tutulur; kısa kesintide ekran çalışmaya devam eder,
  Reverb yeniden bağlanınca fark senkronlanır.
- **Kendi POS/kiosk (v3):** offline-first zorunlu — yerel DB + kuyruk; mali fiş/ÖKC
  akışı offline kuyruklanıp bağlantıda iletilir.
- **Çakışma çözümü:** sunucu otoritedir; `updated_at` + versiyon ile last-write-wins,
  sipariş kalemlerinde ekleme-birleştirme (append) mantığı. Stok/86 çakışmasında sunucu kazanır.
- **Kapsam:** MVP'de PWA menü offline görüntüleme; sipariş kuyruklama + garson/KDS offline **V2**;
  tam POS offline **V3**.

## 4.12 Tüketici portalı & keşif (Marketplace — M20) *(V2/V3)*

Kurulu işletme tabanını tüketiciye açan iki taraflı katman. Ayrı bir okuma-yoğun
servis olarak tasarlanır; işletmelerin panel/operasyon yükünü etkilemez.

- **Public discovery servisi:** işletmelerin `is_public` + yayın durumu olan verisi
  (profil, menü özeti, konum, kategori) okunur; operasyonel tablolardan izole,
  denormalize bir **keşif/okuma modeli** (materialized view / arama indeksi) beslenir.
- **Geo/konum:** şube `lat/lng` üzerinden "yakınımdaki" (PostGIS/`earthdistance` veya
  harici geo), şehir/ülke kırılımı, harita için bbox sorguları. Sonuçlar Redis'te cache'lenir.
- **Arama & filtre:** mutfak, fiyat, "şu an açık" (çalışma saati + zaman dilimi),
  puan, özellik etiketleri, **diyet filtresi** (M2 `nutrition_summaries`/diyet etiketinden).
  Ölçekte Meilisearch/Typesense veya PostgreSQL FTS + pgvector (semantik "deniz manzaralı sakin mekan").
- **SEO:** işletme sayfaları ve "şehir × kategori" landing'leri Next.js ile **SSG/ISR**,
  `sitemap.xml`, JSON-LD (`Restaurant`/`Menu` schema.org) — organik keşfedilebilirlik.
- **Tüketici kimliği:** cross-venue tek hesap (Sanctum), favoriler/sipariş geçmişi
  tenant sınırından bağımsız ama tenant verisine yetkiyle erişir.
- **Yayın kontrolü:** işletme profili/menüsü portala çıkmadan önce tenant onayı; KVKK
  gereği yalnızca işletmenin kamuya açıkladığı alanlar indekslenir.
- **Kapsam:** web portal + işletme public sayfası + keşif/filtre **V2**; native app +
  cross-venue hesap + favoriler/yorum + sponsorlu listeleme **V3**.
