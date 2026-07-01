# 06 — API Sözleşmesi (REST)

Taban: `https://api.comiqr.com/v1`. Tenant, subdomain veya `X-Tenant` header /
QR token ile çözülür. Yetki: Sanctum Bearer token (panel/garson), QR token
(public menü/sipariş). Tüm yanıtlar JSON, `snake_case`, standart zarf:
`{ data, meta, errors }`. Rate limit header'ları döner.

> Tam liste değil, **sözleşme örüntüsü**. Claude Code kalanları bu örüntüyle türetir.

## 6.1 Auth & tenant

```
POST   /auth/register-tenant      # self-servis onboarding (işletme + owner + subdomain)
POST   /auth/login                # panel/garson login → token
POST   /auth/logout
GET    /auth/me
POST   /auth/2fa/verify           # superadmin/owner
GET    /tenant                    # aktif tenant ayarları
PATCH  /tenant                    # ayar/branding/locale güncelle
```

## 6.2 Public menü (QR — token'lı, auth'suz)

```
GET    /menu/{qrToken}            # menü + kategori + ürün + varyasyon + modifier + nutrition_summary + i18n
GET    /menu/{qrToken}/product/{id}   # ürün detay (besin tablosu, alerjen, diyet bayrağı dahil)
GET    /menu/{qrToken}/filters    # diyet/kalori filtre seçenekleri (reçeteden türetilmiş)
POST   /menu/{qrToken}/view       # menu_view event (ısı haritası)
```

Menü yanıtı `locale` query ile çevrilir; `?diet=vegan&max_kcal=500` filtreler.

## 6.3 Sipariş (QR oturumu)

```
POST   /sessions/{qrToken}/open           # masa oturumu aç
POST   /orders                            # sipariş oluştur (order_items + modifiers + note)
GET    /orders/{id}                        # durum + canlı takip
POST   /orders/{id}/items                  # çok turlu: item ekle
POST   /sessions/{id}/call-waiter          # garson çağır → Reverb
POST   /sessions/{id}/request-bill         # hesap iste → Reverb
```

## 6.4 Ödeme

```
POST   /orders/{id}/pay                    # gateway (tiko|paytr) + split opsiyonu → PaymentSession
POST   /payments/webhook/{gateway}         # imza doğrulamalı webhook
POST   /orders/{id}/split                  # hesap bölüşme kur (kişi/ürün bazlı)
POST   /orders/{id}/tip                     # bahşiş
GET    /orders/{id}/invoice                # e-fatura/fiş referansı
```

## 6.5 Menü yönetimi (panel — auth)

```
# Kategori / ürün / varyasyon / modifier
GET|POST         /admin/categories
PATCH|DELETE     /admin/categories/{id}
GET|POST         /admin/products
PATCH|DELETE     /admin/products/{id}
POST             /admin/products/import          # Excel/CSV toplu
POST             /admin/products/bulk-price       # toplu fiyat
POST             /admin/products/{id}/translations
GET|POST         /admin/modifier-groups
```

## 6.6 Reçete & besin (panel — ⭐)

```
GET|POST         /admin/ingredients               # malzeme ana kartı (besin+alerjen+maliyet)
PATCH|DELETE     /admin/ingredients/{id}
GET              /admin/ingredient-library         # hazır doğrulanmış malzeme arama (V2)
POST             /admin/ingredients/ai-estimate     # AI besin tahmini (V3)
GET|PUT          /admin/products/{id}/recipe        # reçete oku/kaydet (items + yield)
GET              /admin/products/{id}/nutrition      # hesaplanmış özet (kcal/makro/alerjen/maliyet)
POST             /admin/products/{id}/nutrition/recompute
GET              /admin/allergens
```

`PUT /recipe` kaydında besin özeti **queue job** ile yeniden hesaplanır; yanıt
`is_stale=true` döner, hesap bitince Reverb ile panel güncellenir.

## 6.7 KDS

```
GET    /kds/{branchId}/orders?station={id}        # aktif siparişler (istasyon)
POST   /kds/order-items/{id}/status                # accepted|preparing|ready
POST   /kds/order-items/{id}/bump                  # tamamla → listeden düş
POST   /kds/eighty-six                              # ürün 86 → menüye anında yansı
DELETE /kds/eighty-six/{id}                         # 86 kaldır
```

## 6.8 Garson app

```
GET    /waiter/tables                               # masa durum panosu
GET    /waiter/notifications                         # çağrı/hazır/hesap (poll + Reverb)
POST   /waiter/orders                                # manuel sipariş (V2)
POST   /waiter/orders/{id}/served
POST   /waiter/tables/{id}/move|merge|split          # adisyon işlemleri (V2)
```

## 6.9 CRM / sadakat / kampanya *(V2)*

```
GET    /admin/customers?segment=...
GET|POST /admin/coupons
GET|POST /admin/campaigns                            # channel: email|sms|whatsapp|push
POST   /admin/campaigns/{id}/send
GET    /admin/loyalty/settings | POST redeem/earn
```

## 6.10 AI *(V2/V3)*

```
POST   /admin/ai/translate-menu                      # toplu çeviri
POST   /admin/ai/product-copy                        # açıklama üret
POST   /admin/ai/menu-engineering                    # kârlılık×popülerlik insight
POST   /admin/ai/image | /ai/video                   # Higgsfield hattı (async)
GET    /menu/{qrToken}/recommendations               # kişiselleştirilmiş öneri
POST   /menu/{qrToken}/chat                           # menü chatbot
```

## 6.11 Analitik & superadmin

```
GET    /admin/analytics/overview|heatmap|profitability|menu-performance
GET    /admin/reports/owner-summary                   # patron mobil app (ciro/kasa/stok/top-ürün)
GET    /superadmin/tenants                            # 2FA + audit
POST   /superadmin/tenants/{id}/impersonate
GET    /superadmin/audit-logs
```

## 6.12 Menulux boşluk modülleri *(V2/V3)*

```
# Envanter (M18)
GET|POST   /admin/suppliers | /admin/purchase-orders | /admin/stock-counts
POST       /admin/stock-movements                     # fire/transfer/restock
GET        /admin/inventory/low-stock

# Kiosk (M16)
GET        /kiosk/{deviceToken}/menu                  # kiosk menü (tam ekran)
POST       /kiosk/{deviceToken}/orders                # kiosk sipariş → KDS + ödeme

# Signage / Menuboard (M17)
GET|POST   /admin/signage/screens | /admin/signage/playlists
GET        /signage/{screenToken}/playlist            # ekranın çalacağı içerik (daypart'lı)

# Kurye / Teslimat (M10/M14)
GET|POST   /admin/couriers
POST       /deliveries/{id}/assign|status             # atama + durum (picked/enroute/delivered)
POST       /webhook/courier/{provider}                # Fiyuu/Maxijett/Paket Taxi

# Mali fiş / Yazarkasa (M14 — TR)
POST       /orders/{id}/fiscal-receipt                # ÖKC'ye mali fiş kes (Beko/Ingenico/Pavo…)
GET        /admin/fiscal/z-report

# ERP senkron (M14)
POST       /admin/erp/{target}/sync                   # Logo/Mikro/Netsis/Uyumsoft
GET        /admin/erp/sync-logs

# Delivery platform toplama (M14)
POST       /webhook/delivery/{provider}               # Yemeksepeti/Getir/Trendyol/Migros/Fuudy
GET        /admin/delivery/orders                      # tüm kanallar tek panelde
```

## 6.13 Tüketici Portalı & Keşif (Marketplace — M20) *(V2/V3)*

```
# ---- Public keşif (auth'suz, okuma; SEO/SSG dostu) ----
GET    /discover/countries                          # ülke listesi
GET    /discover/{country}/cities                   # şehirler
GET    /discover/venues                             # ana keşif; query: country, city, category,
                                                    #   cuisine, price, open_now, rating_min,
                                                    #   features[], diet[], lat,lng,radius, sort, page
GET    /discover/venues/near?lat=&lng=&radius=      # yakınımdaki (geo)
GET    /discover/venues/map?bbox=                   # harita için sınır kutusu sorgusu
GET    /discover/search?q=                          # metin/semantik arama (FTS/pgvector)
GET    /discover/venues/{venueSlug}                 # işletme public profili (galeri, saat, konum, kampanya)
GET    /discover/venues/{venueSlug}/menu            # işletmenin canlı menüsü (fiyat/görsel/kalori/alerjen)
GET    /discover/city/{citySlug}/{categorySlug}     # "şehir × kategori" landing (SEO)
GET    /discover/venues/{venueSlug}/reviews         # yorumlar

# ---- Tüketici hesabı (cross-venue, Sanctum) ----
POST   /consumer/auth/register | login | social
GET    /consumer/me                                 # profil + tercihler
GET    /consumer/favorites                          # favori işletmeler
POST   /consumer/favorites/{venueSlug}              # favoriye ekle/çıkar
GET    /consumer/orders                             # tüm işletmelerdeki sipariş geçmişi
POST   /consumer/venues/{venueSlug}/reviews         # yorum (doğrulanmış sipariş)

# ---- İşletme paneli: portal yönetimi ----
GET    /admin/venue-profile                         # profil (about, saat, foto, özellik, kategori)
PUT    /admin/venue-profile                         # güncelle
POST   /admin/venue-profile/publish                 # portala yayınla/gizle (is_public)
POST   /admin/venue-profile/media                   # foto/logo/kapak yükle (R2)
GET    /admin/venue-profile/promotions              # kampanya yönetimi
POST   /admin/sponsored-placements                  # öne çıkarma/sponsorlu (gelir)
```

> Public keşif uçları tenant sınırından bağımsızdır ama yalnızca `is_public` + yayınlanmış
> profilleri döndürür. Menü verisi denormalize keşif modelinden okunur (operasyon tablolarına yazma yok).

## 6.14 Hata & yetki kuralları

- 401 auth yok, 403 rol/tenant ihlali, 422 doğrulama (`errors` alanı), 429 rate limit.
- Her yazma işlemi policy'den geçer; tenant sınırı global scope ile garanti.
- Webhook uçları imza doğrulaması olmadan işlenmez.
- Kiosk/signage token'ları cihaz bazlı, imzalı ve iptal edilebilir.
