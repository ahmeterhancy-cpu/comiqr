# 08 — Rakip Boşluk Analizi: Menulux

Bu dosya, pazar lideri **Menulux**'e karşı yapılan boşluk analizini ve kapatma
planını tutar. Amaç: hangi eksik nereye (hangi modül/faz) işlendi, net olsun.

Menulux profili: 2013'ten beri, 3000+ işletme, ATP Capital'e bağlı, **POS-merkezli
tam otomasyon paketi** + donanım satışı + bayilik ağı. TR odaklı, olgun.

---

## Nerede zaten öndeyiz (Menulux'te yok)

- **Reçete & Besin Değeri Motoru** — kalori/makro/alerjen otomatik (bkz. `docs/03`)
- **AI**: kişiselleştirme, otomatik upsell, içerik/görsel/video üretimi, çeviri, menü mühendisliği (Higgsfield + Laravel AI SDK)
- **Turizm derinliği**: çok dilli (TR/EN/DE/RU/AR), otel/plaj/etkinlik dikeyleri
- **KKTC-yerel ödeme** (Tiko/PayTR) + **Kıbrıs Biletcim** etkinlik köprüsü
- **Gerçek multi-tenant white-label SaaS**

Konum: kafa kafaya değil, farklı eksende (AI + SaaS + turizm) yarışıyoruz.

---

## Boşluklar ve kapatma planı

| # | Menulux'te var, bizde eksikti | Kapatma | Modül | Faz |
|---|---|---|---|---|
| 1 | **Offline çalışma** (internet kesilince devam) | Offline-first mimari (PWA cache, garson/KDS outbox, POS yerel DB) | M6 + `docs/04 §4.11` | **V2** (POS offline V3) |
| 2 | **Yazarkasa / ÖKC** mali onaylı ödeme | ÖKC entegrasyonu (Beko/Ingenico/Pavo/Verifone/Hugin) + `fiscal_receipts` | M14 | **V2** |
| 3 | **ERP/muhasebe** (Logo/Mikro/Netsis/Uyumsoft/SAP) | ERP konnektörleri + `erp_sync_logs` | M14 | **V2** |
| 4 | **Delivery + kurye** (Yemeksepeti/Getir/Trendyol/Migros/Fuudy + Fiyuu/Maxijett) | Platform toplama V2'ye çekildi; kurye app + entegrasyon | M14 + M10 | **V2** (kurye V3) |
| 5 | **Self-Order Kiosk** | Kiosk modu (aynı menü/sipariş/ödeme) | **M16** (yeni) | **V2** |
| 6 | **Dijital Menuboard / Signage** | Ekran menü/kampanya + AI video içerik | **M17** (yeni) | **V2** (AI signage V3) |
| 7 | **Tam envanter/stok** (tedarikçi/PO/sayım/fire) | Reçete düşümü üstüne tam envanter | **M18** (yeni) | **V2-V3** |
| 8 | **Patron mobil rapor app** (Boss App) | Owner summary + mobil rapor | M9 | **V2** |
| 9 | **Tablet menü** (masada iPad) | Tablet menü modu | M11 | **V2** |
| 10 | **Personel yönetimi** | Mesai/vardiya/performans | M10 | **V3** |
| 11 | **Kasa müşteri ekranı** (customer display) | İkinci ekran app | M11 | **V3** |
| 12 | **Kendi POS / adisyon** (Menulux çekirdeği) | Stratejik: v1-v2 QR+KDS+entegrasyon; kendi POS v3 hedefi | **M19** (yeni) | **V3 (stratejik)** |
| 13 | **Robot garson** | Runner/robot entegrasyonu (opsiyonel) | M19 notu | **V3+** |

---

## Stratejik notlar (kod değil, GTM)

- **Kendi POS kararı:** v1-v2'de QR/sipariş + KDS + harici POS entegrasyonu ile git;
  kendi tam POS'unu **v3 stratejik hedef** olarak tut. Böylece MVP şişmez ama Menulux'le
  kafa kafaya rekabet kapısı açık kalır. (Karar sende — v3'e koyduk.)
- **Donanım paketleme:** Menulux donanım+yazılım bundle satıyor (Beko POS vb.). Biz
  software-only mıyız yoksa bir donanım partneriyle mi? — GTM kararı, ürün kapsamı dışı.
- **Bayilik vs white-label:** Menulux'ün bayi ağı var; bizim white-label (M12/V3) buna
  yakın. Amesis için reseller programı ayrı bir büyüme kanalı olarak değerlendirilebilir.

---

## Öncelik özeti

1. **Kritik dört (V2):** offline · yazarkasa/ÖKC · ERP · delivery+kurye — TR pazarına giriş şartı.
2. **Ürün genişlemesi (V2-V3):** kiosk · menuboard · tam envanter · patron app · tablet menü.
3. **Stratejik (V3):** kendi POS · personel · customer display · kurye app · robot.

Bu boşluklar `docs/02` (modüller), `docs/04` (offline), `docs/05` (tablolar),
`docs/06` (uçlar) ve `docs/07` (faz) dosyalarına işlendi.
