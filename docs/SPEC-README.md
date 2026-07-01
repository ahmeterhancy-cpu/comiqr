# ComiQR — Gelişmiş QR Menü SaaS Platformu

**Claude Code teslim paketi.** Bu depo, restoranlar için gelişmiş bir çok kiracılı
QR menü / sipariş / operasyon platformunun tam ürün ve teknik spesifikasyonudur.

> `ComiQR` bir çalışma kod adıdır. Nihai marka adı değişebilir (bkz. `CLAUDE.md`).

## Bu paket nedir?

Kod değil, **kodun üretileceği spesifikasyon**. Claude Code bu dosyaları okuyup
adım adım uygulamayı inşa eder. Her dosya belirli bir katmanı tanımlar.

## Nasıl kullanılır (Claude Code)

1. Depoyu aç, `claude` başlat.
2. Claude Code önce **`CLAUDE.md`** dosyasını okur (proje, stack, kurallar, build order).
3. `docs/07-yol-haritasi.md` içindeki **Faz 0**'dan başla.
4. Her modül için ilgili spec'i referans göster:
   - "Menü modülünü `docs/02` ve `docs/05`'e göre kur"
   - "Reçete/besin motorunu `docs/03`'e göre uygula"

## Ana özellikler (özet)

- Çok kiracılı SaaS + self-servis onboarding + white-label
- AI kişiselleştirme + otomatik upsell + içerik/görsel/video üretimi + çeviri
- **Reçete & Besin Değeri Motoru** — her yemeğin reçetesi; kalori/makro/alerjen otomatik hesap, menüde detaylı gösterim, maliyet + stok bağlantısı
- Scan-order-pay + hesap bölüşme + garson çağır + canlı sipariş takibi
- POS/KDS entegrasyonu + gerçek zamanlı mutfak akışı
- Garson mobil app + müşteri PWA (+ v3 native müşteri app)
- Sadakat/CRM + kampanya + Brevo/SMS/WhatsApp otomasyon + Google yorum
- Yerel ödeme (Tiko/PayTR) + KVKK uyumu + çok dilli (TR/EN/DE/RU/AR)
- Turizm dikeyleri: otel oda servisi, plaj/şezlong, bar, etkinlik (Biletcim köprüsü)

## Yığın

Next.js 16 · Laravel 13 · PostgreSQL (Neon) · Redis (Upstash) · Laravel Reverb ·
React Native/Expo · Tiko/PayTR · Cloudflare R2 · Hetzner VPS + Cloudflare.

## Dosyalar

```
CLAUDE.md                       Claude Code ana talimatları
docs/00-altyapi-kararlari.md    Altyapı karar kaydı (ADR) — kilitli stack + gerekçe
docs/01-urun-vizyonu.md         Vizyon / pazar / konumlandırma / iş modeli
docs/02-ozellik-kataloğu.md     Tüm özellikler + faz etiketleri
docs/03-recete-besin-modulu.md  Reçete & besin değeri motoru (derin)
docs/04-teknik-mimari.md        Mimari & akışlar & güvenlik
docs/05-veritabani-semasi.md    DB şeması
docs/06-api-spec.md             API sözleşmesi
docs/07-yol-haritasi.md         MVP → v2 → v3
docs/08-rakip-bosluk-analizi.md  Menulux boşluk analizi + kapatma planı
```
