# 05 — Veritabanı Şeması (PostgreSQL 16+)

Konvansiyon: snake_case tablo/kolon, her tenant tablosunda `tenant_id`, `id`
BIGINT unsigned, `created_at/updated_at`, gerektiğinde `deleted_at` (soft delete).
Para: `DECIMAL(12,2)`; besin: `DECIMAL(10,2)`. Çeviri: ayrı `*_translations`.
**PostgreSQL notları:** tüm `*_json` kolonları **JSONB** (GIN indeksli); PK'ler
`BIGSERIAL`/identity; `menu_views` gibi yoğun tablolar tarih bazlı **partition**;
AI embedding için ilgili tablolarda **pgvector** (`vector`) kolonu.

## 5.1 Tenant & kimlik

**tenants**
`id, name, slug (subdomain), custom_domain, plan_id, status, locale_default,
currency, timezone, settings_json, trial_ends_at, created_at`

**plans**
`id, code (free|pro|business|enterprise), name, price_monthly, price_yearly,
limits_json (branch/menu/scan/ai_credit limitleri), features_json`

**subscriptions**
`id, tenant_id, plan_id, status, current_period_end, gateway_ref`

**users**
`id, tenant_id (nullable → superadmin), name, email, phone, password,
role (owner|manager|waiter|kitchen|superadmin), two_factor_secret, last_login_at`

**branches** (şube)
`id, tenant_id, name, address, phone, lat, lng, timezone, is_active, settings_json`

**audit_logs**
`id, tenant_id, user_id, action, subject_type, subject_id, meta_json, ip, created_at`

## 5.2 Menü

**categories**
`id, tenant_id, branch_id (nullable=tümü), parent_id, name, sort, is_active, image_path,
daypart_json (opsiyonel saat aralığı)`

**category_translations**
`id, category_id, locale, name`

**products**
`id, tenant_id, category_id, name, description, price, image_paths_json,
video_path, is_active, sort, prep_minutes, calories_display (bool),
tags_json, external_pos_id`

**product_translations**
`id, product_id, locale, name, description`

**product_variants** (porsiyon/boy)
`id, product_id, name, price_delta, is_default`

**modifier_groups**
`id, tenant_id, name, min_select, max_select, is_required`

**modifiers**
`id, modifier_group_id, name, price_delta, ingredient_id (nullable → besin/maliyet etkisi)`

**product_modifier_group** (pivot)
`product_id, modifier_group_id, sort`

**combos** *(V2)*
`id, tenant_id, name, price, items_json (ürün/varyasyon kombinasyonu), is_active`

## 5.3 Reçete & Besin (⭐ bkz. docs/03)

**ingredients**
`id, tenant_id, name, unit (g|ml|adet), grams_per_unit (adet ise),
kcal, protein_g, carb_g, fat_g, saturated_fat_g, sugar_g, fiber_g, sodium_mg
(hepsi 100g/ml başına), unit_cost, cost_unit, waste_pct,
is_vegan, is_vegetarian, is_gluten_free, stock_qty, low_stock_threshold,
data_source (manual|usda|tuber|ai_estimated), verified_at`

**allergens**
`id, code, name, icon` (14 EU alerjeni seed)

**ingredient_allergen** (pivot)
`ingredient_id, allergen_id, trace (bool)`

**recipes**
`id, tenant_id, product_id (unique), yield_portions, prep_minutes, notes, updated_at`

**recipe_items**
`id, recipe_id, ingredient_id, quantity, unit`

**nutrition_summaries** (türetilmiş cache — product 1:1)
`id, tenant_id, product_id, per_portion_kcal, protein_g, carb_g, fat_g,
saturated_fat_g, sugar_g, fiber_g, sodium_mg, allergen_ids_json, diet_flags_json,
cost_per_portion, suggested_price, margin_pct, computed_at, is_stale`

**stock_movements** *(V2)*
`id, tenant_id, ingredient_id, order_item_id (nullable), qty_delta, reason
(order|manual|waste|restock), created_at`

## 5.4 QR & masa

**dining_areas** *(oda/plaj/salon tipleri)*
`id, tenant_id, branch_id, name, type (table|room|sunbed|stand)`

**tables** (masa/oda/şezlong birimi)
`id, tenant_id, branch_id, dining_area_id, code (Masa 5 / Oda 210 / Şezlong 12),
qr_token (unique, imzalı), is_active`

**table_sessions** (oturum)
`id, tenant_id, table_id, status (open|closed), opened_at, closed_at, guest_count`

## 5.5 Sipariş & ödeme

**orders**
`id, tenant_id, branch_id, table_session_id, source (qr|waiter|preorder),
status (pending|accepted|preparing|ready|served|cancelled),
payment_status (unpaid|partially_paid|paid|refunded),
subtotal, discount_total, tip_total, tax_total, grand_total, note, placed_at`

**order_items**
`id, order_id, product_id, variant_id, quantity, unit_price, modifiers_json,
line_total, status (pending|preparing|ready|served|cancelled), kds_station_id, note`

**payments**
`id, tenant_id, order_id, gateway (tiko|paytr|cash), amount, tip_amount,
status (initiated|paid|failed|refunded), gateway_ref, split_meta_json,
invoice_ref, created_at`

## 5.6 KDS

**kds_stations**
`id, tenant_id, branch_id, name (sıcak|soğuk|bar|tatlı), category_ids_json`

**eighty_six_items** (86 kayıtları)
`id, tenant_id, branch_id, product_id, reason, created_by, until (nullable), created_at`

## 5.7 Müşteri / CRM / Sadakat *(V2)*

**customers**
`id, tenant_id, phone (şifreli), name, email (şifreli), locale, consent_json,
first_seen_at, last_seen_at, total_orders, total_spend`

**loyalty_accounts**
`id, tenant_id, customer_id, points_balance, stamps_balance, tier`

**loyalty_transactions**
`id, loyalty_account_id, type (earn|redeem|adjust), points, order_id, meta_json`

**coupons**
`id, tenant_id, code, type (percent|amount|free_item), value, conditions_json,
valid_from, valid_to, usage_limit, used_count, is_active`

**campaigns**
`id, tenant_id, name, channel (email|sms|whatsapp|push), audience_json,
template_json, schedule_json, status, stats_json`

## 5.8 Analitik & AI

**menu_views** (event — ısı haritası)
`id, tenant_id, branch_id, product_id, table_session_id, locale, viewed_at`
(yoğun tablo → partition/aggregate job ile özetlenir)

**ai_jobs**
`id, tenant_id, type (translate|copy|image|video|insight|nutrition|chat),
input_json, output_json, status, cost_credits, created_at`

**reviews** *(V2)*
`id, tenant_id, branch_id, order_id, rating, comment, google_redirected (bool), created_at`

## 5.9 Menulux boşluk modülleri *(V2/V3)*

**Envanter (M18)**

- **suppliers** `id, tenant_id, name, contact_json, terms`
- **purchase_orders** `id, tenant_id, branch_id, supplier_id, status (draft|sent|received), total, ordered_at, received_at`
- **purchase_order_items** `id, purchase_order_id, ingredient_id, qty, unit_cost`
- **stock_counts** `id, tenant_id, branch_id, counted_at, status` + **stock_count_items** `id, stock_count_id, ingredient_id, expected_qty, actual_qty, variance`
- (mevcut **stock_movements** reçete düşümü + fire/transfer/restock için genişletilir: `reason` = order|manual|waste|restock|transfer)

**Kiosk (M16)**

- **kiosk_devices** `id, tenant_id, branch_id, name, code, is_active, settings_json`
- **kiosk_sessions** `id, tenant_id, kiosk_device_id, order_id (nullable), started_at, ended_at`
- (sipariş `orders.source` = qr|waiter|preorder|**kiosk** olarak genişletilir)

**Signage / Menuboard (M17)**

- **signage_screens** `id, tenant_id, branch_id, name, orientation, resolution, is_active`
- **signage_playlists** `id, tenant_id, name, items_json (menü/kampanya/görsel/video + süre), daypart_json`
- **signage_screen_playlist** (pivot) `screen_id, playlist_id, schedule_json`

**Kurye / Teslimat (M10/M14)**

- **couriers** `id, tenant_id, branch_id, user_id, phone, is_active, current_lat, current_lng`
- **deliveries** `id, tenant_id, order_id, courier_id, status (assigned|picked|enroute|delivered|failed), address_json, assigned_at, delivered_at, external_provider (fiyuu|maxijett|pakettaxi|null)`

**Mali fiş / Yazarkasa (M14 — TR)**

- **fiscal_receipts** `id, tenant_id, branch_id, order_id, device_type (beko|ingenico|pavo|verifone|hugin), fiscal_no, z_report_ref, status, payload_ref, issued_at`

**Personel (M10)**

- **staff_shifts** `id, tenant_id, branch_id, user_id, clock_in, clock_out, role, tips_amount`

**ERP senkron (M14)**

- **erp_sync_logs** `id, tenant_id, target (logo|mikro|netsis|uyumsoft|sap), entity, direction, status, payload_ref, created_at`

## 5.10 Önemli ilişkiler (özet)

- tenant 1—* branch, users, products, ingredients, orders …
- product 1—1 recipe 1—* recipe_items —* ingredient
- product 1—1 nutrition_summary (türetilmiş)
- table 1—* table_session 1—* order 1—* order_item
- order 1—* payment
- ingredient *—* allergen (pivot, trace bayrağıyla)
- order_item → stock_movement (reçete üzerinden düşüm)

## 5.11 İndeksler (kritik)

- Her tenant tablosunda `tenant_id` + sık sorgulanan kolon bileşik indeks.
- `products (tenant_id, category_id, is_active, sort)`
- `orders (tenant_id, branch_id, status, placed_at)`
- `tables.qr_token` unique.
- `menu_views (tenant_id, product_id, viewed_at)` — raporlama.
- `nutrition_summaries.product_id` unique.
- `venue_profiles (is_public, country_id, city_id)` + `branches (lat, lng)` geo indeksi.

## 5.12 Tüketici Portalı & Keşif (Marketplace — M20) *(V2/V3)*

**Coğrafya & taksonomi (global referans tabloları)**

- **countries** `id, name, iso2, slug`
- **cities** `id, country_id, name, slug, lat, lng`
- **venue_categories** `id, key (restaurant|cafe|bar|club|hotel|beach_club|bakery|fastfood|finedining…), name, slug, icon`
- **cuisines** `id, name, slug` *(mutfak türü: Türk, İtalyan, deniz ürünleri…)*
- **venue_features** `id, key (sea_view|outdoor|live_music|pet_friendly|wifi|parking…), name, icon`

**İşletme public profili (branch/tenant'a bağlı, portala açılan yüz)**

- **venue_profiles** `id, tenant_id, branch_id, slug (unique), display_name, headline, about, city_id, country_id, lat, lng, address, phone, whatsapp, socials(jsonb), price_level(1-4), opening_hours(jsonb), is_public, is_verified, is_sponsored, rating_avg, rating_count, published_at`
- **venue_profile_category** (pivot) `venue_profile_id, venue_category_id`
- **venue_profile_cuisine** (pivot) `venue_profile_id, cuisine_id`
- **venue_profile_feature** (pivot) `venue_profile_id, venue_feature_id`
- **venue_media** `id, venue_profile_id, type (photo|logo|cover), url (R2), sort`

**Tüketici (cross-venue — tenant sınırından bağımsız)**

- **consumers** `id, name, email, phone, auth_provider, locale, created_at` *(portal kullanıcısı)*
- **consumer_favorites** `id, consumer_id, venue_profile_id, created_at`
- **consumer_reviews** `id, consumer_id, venue_profile_id, order_id?(doğrulanmış), rating(1-5), comment, status(pending|published|hidden), created_at`
- **venue_promotions** `id, venue_profile_id, title, body, image_url, starts_at, ends_at, is_active` *(portalda görünen kampanya)*
- **sponsored_placements** `id, venue_profile_id, city_id?, category_id?, tier, starts_at, ends_at, price, status` *(gelir — öne çıkarma)*

> **Not:** portal, operasyonel menü verisini **okur** (denormalize keşif modeli / materialized
> view: fiyat, görsel, kalori/alerjen özeti). Yazma yok — operasyon tablolarını etkilemez.
> Yalnızca `is_public` + yayınlanmış alanlar indekslenir (KVKK).

**Portal indeksleri:** `venue_profiles (is_public, city_id, is_sponsored, rating_avg)`,
coğrafi `(lat,lng)` (PostGIS/earthdistance), `consumer_favorites (consumer_id)` unique(consumer_id,venue_profile_id).
