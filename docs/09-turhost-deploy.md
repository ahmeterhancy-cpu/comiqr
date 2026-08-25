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

## Kabuk erişimi kapalı — ne değişiyor

cPanel şu uyarıyı veriyor: *"Your system administrator must enable shell access
to allow you to view clone URLs."*

| | Durum |
|---|---|
| Klon adreslerini görüntüleme | ❌ Kabuk gerekiyor |
| `.cpanel.yml` dağıtım görevleri | ✅ Çalışır — artisan/composer **yalnız** buradan koşturulabilir |
| Elle `php artisan ...` | ❌ Terminal yok |

Yani dağıtım görevleri tek çalıştırma yolumuz. Tek seferlik işler de (migrate,
yönetici hesabı) oraya konur.

## Private depo klonlanamıyor

cPanel klon adresinde parola kabul etmiyor:

> The clone URL cannot include a password.

SSH olmadığı için deploy key de üretilemiyor. Pratikte private bir depoyu bu
hesaba klonlamanın yolu yok. İki seçenek kalıyor:

1. **Depoyu public yap.** Öncesinde iki şey doğrulanmalı:
   - `.env` **hiç** commit'lenmemiş olmalı — Git geçmişi de okunur, geçmişte
     geçen bir parola yanmış sayılır. *(Kontrol edildi: hiç commit'lenmemiş.)*
   - Seeder'daki varsayılan parolalar temizlenmeli. *(Düzeltildi: süperadmin
     parolası artık `SUPERADMIN_PASSWORD`'dan gelir ve üretimde zorunludur.)*
2. **Git'ten vazgeç**, Dosya Yöneticisi ile ZIP yükle. Güncellemeler elle.

## İlk dağıtım = teşhis

`.cpanel.yml` şu an bilerek yalnız dosya kopyalıyor ve ev dizinine
**`deploy-report.txt`** yazıyor. Cevabını bilmediğimiz soru şu: cPanel'in
dağıtım görevleri bu hesapta `php` ve `composer` çalıştırabiliyor mu?
(Kabuk erişimi kapalı olan hesaplarda bazen çalışır, bazen dağıtım hiç
tetiklenmez.)

İlk **Deploy HEAD Commit**'ten sonra Dosya Yöneticisi'yle
`/home/<kullanıcı>/deploy-report.txt` dosyasını açın. İçinde `php -v` çıktısı,
composer ve node yolları, `vendor/` ve `.env` durumu var.

### A) Rapor `php` çalışıyor diyorsa — tam Git akışı

`.cpanel.yml`'e şu iki görev eklenir ve **her güncelleme tek tık** olur:

```yaml
    - cd $APPPATH && php /usr/local/bin/composer install --no-dev --optimize-autoloader --no-interaction
    - cd $APPPATH && php artisan migrate --force
```

(`composer.phar` yoksa bir kez `~/composer.phar` olarak yüklenir; yol rapora
göre ayarlanır.)

### B) Rapor `php` çalışmıyor diyorsa

Kod yine Git'ten gelir, ama iki iş elle kalır:

- **`vendor/`** bir kez ZIP olarak Dosya Yöneticisi'yle `~/comiqr/` altına
  çıkarılır (üretimde ~68 MB). Yalnız composer bağımlılıkları değişince tekrarlanır.
- **`migrate`** tek seferlik cron ile koşturulur:
  ```
  /usr/local/bin/php /home/<kullanıcı>/comiqr/artisan migrate --force >> /home/<kullanıcı>/migrate.log 2>&1
  ```
  Çalıştıktan sonra `migrate.log` kontrol edilip cron **silinir**.

> Uzun vadede B senaryosunda bile tam otomasyon mümkün: GitHub Actions
> `composer install --no-dev` çalıştırıp sonucu bir `deploy` dalına yazar,
> cPanel o dalı çeker. Böylece vendor depoda durmaz ama sunucuya Git'le gelir.
> Önce A/B'nin hangisi olduğunu görelim.

## `.cpanel.yml` yazarken beş kural

Hepsi **sessiz** hataya yol açar — deploy düşer, "Last Deployed" son başarılı
commit'te donar, ekranda hata görünmez.

1. **Her görev tek satır.** Çok satırlı komut ayrıştırıcıyı kırar.
2. **Metinlerde iki nokta + boşluk kullanma.** `echo "ENV: VAR"` dosyayı
   geçersiz YAML yapar.
3. **Mutlak yol kullan** (`/bin/cp`, `/bin/mkdir`). Deploy kabuğunun PATH'i dar;
   `rsync` çoğu sunucuda yok.
4. **`.env` ve `storage/` kopyalamadan hariç**, ama `storage/framework/{cache,
   sessions,views}` iskeletini `mkdir -p` ile kur — ilk dağıtımda yoklar.
5. **Kendi günlüğünü yaz** (`>> ~/deploy-son.log 2>&1`).

## Koddaki tuzaklar

**`env()` yalnız config dosyalarında.** `config:cache` sonrası Laravel `.env`'i
hiç yüklemez; başka yerdeki `env()` null döner. *Bizde tek ihlal seeder'daydı —
süperadmin parolası sessizce `password` oluyordu. `config/platform.php`'ye
taşındı ve üretimde parola verilmezse seeder hata veriyor.*

**vendor PHP sürümü.** Yerel PHP sunucudan yeniyse vendor'a sürüm kontrolü
gömülür ve site açılmaz. Sunucunun sürümünü `apps/api/composer.json`'a yazın:

```json
"config": { "platform": { "php": "8.3.33" } }
```

Sunucudaki sürümü cPanel → **MultiPHP Manager** ve **PHP Selector** ayrı ayrı
gösterir; ikisi farklı olabilir.

**`storage:link` bize gerekmiyor.** Medya `/v1/media/{path}` üzerinden PHP ile
servis ediliyor (`Storage::disk('public')->response()`), symlink üzerinden
değil. Paylaşımlı barındırmanın klasik symlink derdi bu projede yok.

## Yayın döngüsü

**Update from Remote** → **Deploy HEAD Commit** → *Last Deployed* SHA değişti mi
bak. İkisi ayrı iş; yalnız ikincisine basmak eski kodu tekrar kurar.

## Asgari `.env`

```
APP_NAME=ComiQR
APP_ENV=production
APP_DEBUG=false
APP_KEY=            # php artisan key:generate ile üretin
APP_URL=https://api.alanadiniz.com

DB_CONNECTION=mysql
DB_HOST=localhost              # 127.0.0.1 DEGIL - cPanel yetkiyi @localhost verir
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

SUPERADMIN_EMAIL=
SUPERADMIN_PASSWORD=           # uretimde zorunlu; verilmezse seeder hata verir

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
