# Turhost (cPanel) denemesi — API'yi paylaşımlı barındırmada yayına alma

Bu belge, ComiQR'ın **Laravel API'sini** Turhost'un paylaşımlı (cPanel) paketinde
cPanel Git üzerinden yayına almayı anlatır. Kapsamı ve sınırları açıkça yazıyoruz;
projenin kalıcı barındırma kararı hâlâ `docs/00 — Karar 3` (VPS + Cloudflare).

## Ne çalışır, ne çalışmaz

| Parça | Paylaşımlı cPanel'de |
|---|---|
| Laravel API | ✅ PHP 8.3+, MySQL ile |
| Panel · müşteri menüsü · mutfak ekranı (3 Next.js) | ❌ SSR — sürekli çalışan Node süreci ister |
| Reverb (WebSocket) | ❌ Kalıcı daemon ister |
| Kuyruk işçisi | Gerekmiyor — `QUEUE_CONNECTION=sync` |
| Zamanlanmış görevler | ✅ cPanel cron |

**Reverb'in olmaması işlev kaybettirmez.** Sipariş, garson ve otel ekranları
zaten yokluyor (4–8 sn). Canlı akış yerine yoklama çalışır.

**Next.js tarafı için tek soru:** cPanel'de **"Setup Node.js App"** var mı?

- **Varsa** — uygulamalar `public_html` dışında çalışır, cPanel onları web köküne
  proxy'ler. Üçü de aynı hesapta durabilir.
- **Yoksa** — Next tarafı burada çalışamaz. Pratik bölünme: **API Turhost'ta,
  üç Next uygulaması Vercel'de**. `NEXT_PUBLIC_API_URL` Turhost'taki API'yi
  gösterir, `CORS_ALLOWED_ORIGINS` da Vercel adreslerini içerir.

## Veritabanı: MySQL

Kod artık iki sürücüde de çalışıyor (`DB_CONNECTION=mysql` yeterli):

- Şemadaki 21 `jsonb` kolonu `json`'a çevrildi — MySQL 5.7.8+ ve MariaDB 10.2+
  destekler.
- Sürücüye özgü üç ham SQL taşınabilir hâle getirildi: `to_char(...)` → `date(...)`,
  iki `::numeric` dökümü kaldırılıp yuvarlama PHP'ye alındı.
- Egzotik kolon tipi yok; en uzun indeks adı MySQL'in 64 karakter sınırının altında.

**Uyarı:** Çok eski bir MySQL (5.7 öncesi ayarlar, `utf8mb4` + 767 bayt indeks
sınırı) `varchar(255)` üzerindeki `unique` indekslerde hata verebilir. O durumda
`AppServiceProvider::boot()` içine `Schema::defaultStringLength(191)` eklemek
çözer. MySQL 8 / MariaDB 10.4+ ile gerekmez.

**Migration MySQL'de henüz koşturulmadı** — yerelde MySQL sunucusu yok. Testler
(296/296) Postgres'te geçiyor; MySQL'deki ilk `migrate` bu belgedeki ilk gerçek
sınamadır.

## Yerleşim

Laravel'in kodu web kökünün **dışında** durmalı. Aksi hâlde `.env`, `storage/`
ve `vendor/` tarayıcıdan indirilebilir.

```
/home/<kullanıcı>/
├── comiqr/            ← uygulama (apps/api içeriği) — servis EDİLMEZ
│   ├── .env           ← elle oluşturulur, depoda yok
│   └── storage/
└── public_html/       ← web kökü
    ├── index.php      ← ~/comiqr'a işaret eder
    └── ...            ← public/ içeriği
```

## Adımlar

1. **Depoyu uzak sunucuya al.** cPanel Git bir uzak adresten çeker; önce projeyi
   GitHub'a (private) push edin. Şu an uzak depo yok.
2. **cPanel → Git Version Control** → depoyu klonlayın.
3. **`.cpanel.yml` içindeki `CPANEL_KULLANICI`'yı** kendi kullanıcı adınızla
   değiştirin.
4. **MySQL veritabanı ve kullanıcısı oluşturun** (cPanel → MySQL Databases).
5. **`~/comiqr/.env` dosyasını oluşturun** — aşağıdaki asgari set.
6. **Deploy HEAD Commit** deyin; `.cpanel.yml` composer + migrate + cache yapar.
7. **Cron ekleyin** (cPanel → Cron Jobs, dakikada bir):
   `cd ~/comiqr && php artisan schedule:run >/dev/null 2>&1`

## Asgari `.env`

```
APP_NAME=ComiQR
APP_ENV=production
APP_DEBUG=false
APP_KEY=            # php artisan key:generate ile üretin
APP_URL=https://api.alanadiniz.com

DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=<cpanel_db>
DB_USERNAME=<cpanel_user>
DB_PASSWORD=<parola>

QUEUE_CONNECTION=sync
BROADCAST_CONNECTION=log      # Reverb yok
CACHE_STORE=file
SESSION_DRIVER=file

# Frontend nerede duruyorsa oradan gelen isteklere izin verin.
# `*` BIRAKMAYIN — canlıda her siteye açık demektir.
CORS_ALLOWED_ORIGINS=https://panel.alanadiniz.com,https://menu.alanadiniz.com

AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=
# AI_VISION_PROVIDER boş: fotoğraftan menü içe aktarma kapalı (DeepSeek görsel okumaz).
```

## Canlıya çıkmadan kapatılacaklar

- `APP_DEBUG=false` ve gerçek bir `APP_KEY`
- `CORS_ALLOWED_ORIGINS` — varsayılan `*` **bırakılmamalı**
- Tiko ödeme kimlikleri (yoksa varsayılan ödeme yöntemi nakit kalır)
- Gerçek SMTP ayarları
- `storage/` ve `bootstrap/cache/` yazılabilir olmalı
