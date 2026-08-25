# ComiQR Fiş Köprüsü

İşletmenin kendi ağında çalışan küçük bir program. ComiQR'daki fiş kuyruğunu
izler, sırası gelen fişi ESC/POS biçimine çevirir, yazıcıya gönderir ve sonucu
sunucuya bildirir.

**İş bölümü:** hangi ürün grubunun nerede basılacağına *panel* karar verir
(Ayarlar → Yazıcılar). Bu program yalnızca kâğıda basar. Böylece mutfak
yazıcısının IP'si buluta hiç çıkmaz, yazıcılar da internete açılmak zorunda
kalmaz.

## Gereksinimler

- Node.js 18 veya üzeri (kasa bilgisayarında)
- Yazıcıya ağdan erişim (aynı yerel ağ)
- Panelde **mutfak** yetkili bir kullanıcı (köprü bu hesapla bağlanır)

## Kurulum

```bash
npm install
npm run build
```

`config.example.json` dosyasını `config.json` olarak kopyalayın ve doldurun:

```json
{
  "apiUrl": "https://api.comiqr.com/v1",
  "email": "mutfak@isletmeniz.com",
  "password": "...",
  "pollSeconds": 3
}
```

Çalıştırın:

```bash
npm start
```

## Yazıcı hedefi

Hedef panelde her yazıcı için ayrı yazılır (Ayarlar → Yazıcılar → *Hedef*):

| Biçim | Ne zaman |
|---|---|
| `192.168.1.50:9100` | Ağ yazıcısı (en yaygın). Port yazılmazsa 9100 varsayılır. |
| `\KASA-PC\MUTFAK` | Windows'ta paylaşılmış yazıcı |
| `file:./cikti.bin` | Donanımsız deneme; baytlar dosyaya yazılır |

## Ayarlar

Öncelik sırası: komut satırı → ortam değişkeni → `config.json`.

| Ayar | Bayrak | Ortam | Açıklama |
|---|---|---|---|
| API adresi | `--api` | `COMIQR_API_URL` | `https://.../v1` |
| E-posta | `--email` | `COMIQR_EMAIL` | mutfak kullanıcısı |
| Parola | `--password` | `COMIQR_PASSWORD` | |
| Yazıcı | `--printer` | `COMIQR_PRINTER_ID` | yalnız bu yazıcının kuyruğu |
| Bekleme | `--poll` | — | saniye (varsayılan 3) |
| Hedef ezme | `--target` | `COMIQR_TARGET` | paneldeki hedefi geçersiz kılar |
| Kuru çalışma | `--dry-run` | — | yazıcıya göndermez, ekrana yazar |
| Genişlik | `--width` | — | 80 mm ≈ 42, 58 mm ≈ 32 |

`config.json` içindeki `render` bloğu kâğıt genişliğini, karakter tablosunu ve
kesme biçimini belirler:

```json
"render": { "width": 42, "codepageEscpos": 13, "codepageIconv": "cp857", "partialCut": true }
```

Türkçe karakterler için varsayılan **PC857**'dir (Epson'da `ESC t 13`). Yazıcınız
farklı bir numara istiyorsa `codepageEscpos` değerini değiştirin. Hiç
desteklemiyorsa `"codepageIconv": "ascii"` yapın — harfler sadeleşir (ş → s)
ama fiş okunur kalır.

## Sürekli çalıştırma (Windows)

Görev Zamanlayıcı ile "bilgisayar açılışında" tetikleyin:

- Program: `node`
- Bağımsız değişkenler: `dist\index.js`
- Başlangıç konumu: köprünün klasörü

Kalıcı bir hizmet isterseniz [NSSM](https://nssm.cc) ile aynı komutu servis
olarak kaydedebilirsiniz.

## Sorun giderme

| Belirti | Bakılacak yer |
|---|---|
| `Giriş başarısız` | E-posta/parola; kullanıcının **mutfak** yetkisi olmalı, planın *yazıcı yönlendirme* özelliği açık olmalı |
| `Kuyruğa ulaşılamıyor` | API adresi ve internet. Köprü kendi kendine denemeye devam eder, kapatmayın |
| `yanıt vermedi (zaman aşımı)` | Yazıcının IP'si ve portu; kasa bilgisayarından `ping` ile deneyin |
| `Yazıcı hedefi tanımsız` | Panelde o yazıcının *Hedef* alanı boş |
| Türkçe karakterler bozuk | `codepageEscpos` / `codepageIconv` — çalışmazsa `ascii` |
| Fiş basılmadı, panelde "Başarısız" | Hata metni panelde yazıyor; düzeltip **Tekrar dene** deyin |

Fiş içeriğinin doğruluğunu donanımsız görmek için:

```bash
node dist/index.js --dry-run
```

## Testler

```bash
npm test
```
