# 00 — Altyapı Karar Kaydı (ADR)

Bu dosya, geliştirme başlamadan önce **kilitlenen** altyapı kararlarını ve
gerekçelerini tutar. Claude Code bu kararlara uyar; değiştirmek isterse önce
buradaki gerekçeyi okur ve onay ister.

Tarih: 2026-07 · Durum: **Kilitli (v1)**

---

## Sürümler

- **Frontend: Next.js 16** (App Router, React 19, Turbopack). Sebep: Next.js 14
  Ekim 2025'te EOL oldu; yeni ürün desteklenen major üzerine kurulur.
- **Backend: Laravel 13** (PHP 8.3). Sebep: yıllık kadans, sıfır breaking change;
  **birinci parti Laravel AI SDK (Anthropic hazır)** ve native vektör arama, bu
  AI-ağırlıklı ürün için glue kodu azaltır.
- **Runtime:** Node 22 LTS, PHP 8.3.

## Karar 1 — Veritabanı: **PostgreSQL** ✅ (MySQL değil)

- Çok kiracılı SaaS'ta JSONB + kısmi/GIN indeks, `menu_views` ısı haritası için
  native partitioning, ve **pgvector** ile AI menü önerisi/embedding aynı DB'de.
- Biletcim'de Postgres deseni zaten var.
- **Alternatif:** MySQL (basitlik) — reddedildi, AI/analitik tarafında Postgres önde.

## Karar 2 — DB barındırma: **Neon (managed PostgreSQL, Frankfurt)** ✅

- Havuzlu (pgBouncer) bağlantı string'i kullanılacak (Laravel + serverless PG).
- Yedek/HA yükü managed'a devredilir; pgvector destekli.
- **Çıkış kapısı:** maliyet/kontrol gerekirse aynı motor → self-hosted PostgreSQL
  (Hetzner). Migrasyon düşük riskli.

## Karar 3 — Barındırma: **Lean Hetzner + Cloudflare** ✅ (Vercel değil)

- **Zorunlu gerçek:** Laravel API + **Reverb (WebSocket)** + Redis + queue Vercel'de
  çalışmaz (serverless, kalıcı süreç/WS yok). Backend her halükarda Hetzner'da.
- **Tek açık soru** 3 Next uygulamasının yeriydi → **Hetzner'da** (PM2/Node), önünde
  **Cloudflare**.
- Sebep: (1) Vercel'in tek avantajı olan edge CDN + SSL + per-tenant custom domain'i
  **Cloudflare (+ Cloudflare for SaaS custom hostnames)** zaten karşılıyor — R2 için
  Cloudflare hesabı mevcut; (2) kitle lokal (mekânda QR tarama), global edge faydası
  sınırlı; (3) ince marjlı çok kiracılı SaaS'ta Hetzner sabit maliyet Vercel'in
  trafik bazlı faturasını yener; (4) tek stack/pipeline, cross-origin hop yok.
- **Ne zaman Vercel'e geçilir:** frontend iterasyon hızı + preview deploy + sıfır
  frontend-ops maliyetten değerli olursa ya da kitle globalleşirse → sadece Next
  tarafı Vercel'e taşınır, backend Hetzner'da kalır. Taşıma kolay.

## Karar 4 — Gerçek zamanlı: **Laravel Reverb (Hetzner self-host)** ✅

- Birinci parti, ücretsiz; Redis pub/sub ile yatay ölçek. Sipariş→KDS/garson akışına birebir.
- **Alternatif:** Pusher/Ably (sıfır-ops) — reddedildi, çok kiracıda mesaj bazlı maliyet.

## Karar 5 — Cache/Queue: **Redis (Upstash)** + Horizon ✅

- Biletcim deseni. Session, cache, queue, Reverb pub/sub backend.

## Kilitli (mevcut ekosistemden, tartışmasız)

| Alan | Karar |
|---|---|
| Auth | Laravel Sanctum (token) — Laravel API + Next + Expo |
| Multi-tenancy | Tek DB, row-level `tenant_id` + Eloquent global scope; `stancl/tenancy` çıkış kapısı |
| Depolama | Cloudflare R2 (S3 uyumlu) |
| Ödeme | Tiko + PayTR (soyut `PaymentGateway`) |
| E-posta/SMS/WhatsApp | Brevo + Telsim + WhatsApp Business |
| Push | FCM |
| AI metin | Anthropic (Laravel AI SDK) |
| AI görsel/video | Higgsfield hattı |
| Garson app | React Native + Expo SDK 54+ |
| Müşteri arayüzü | PWA (native değil; opsiyonel native v3) |
| Monorepo | Turborepo + pnpm |
| CI/Deploy | GitHub Actions + `deploy.sh` |

## Topoloji (özet)

```
Cloudflare (CDN + SSL + custom hostnames / white-label)
   │
   ├── isletme.comiqr.com / custom domain  → Next customer PWA  ┐
   ├── admin.comiqr.com                     → Next admin        ├─ Hetzner VPS (Frankfurt)
   ├── kds.comiqr.com                       → Next KDS          │   PM2/Node + Nginx
   └── api.comiqr.com                       → Laravel 13 API    ┘   + PHP-FPM + Reverb + Supervisor
                                                   │
                          Neon (PostgreSQL, FRA) ──┤── Upstash (Redis)
                                                   └── Cloudflare R2 (medya)
        Harici: Tiko/PayTR · Brevo · Telsim · WhatsApp · FCM · Anthropic · Higgsfield
```
