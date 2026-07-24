# ComiQR Garson (mobile-waiter)

Native iOS/Android garson uygulaması — **Expo (SDK 54) + expo-router + NativeWind**.
Kasa/POS **değildir**: yalnızca sipariş alma, sipariş görüntüleme ve mutfak durumu
takibi. Ödeme, fiş/hesap yazdırma, indirim/iade, vardiya **yoktur** (bunlar web
`/pos` kasa terminalinde kalır).

## Ekranlar (`app/`)
- `login.tsx` — garson girişi (e-posta + parola → `/v1/auth/login`).
- `board.tsx` — kat planı + bildirimler (garson çağrısı/hesap → Onayla, hazır ürün → Servis Et). 5 sn poll.
- `order.tsx` — masaya dokununca: masadaki sipariş + canlı mutfak durumu, ürün seç (varyant/modifier modalı), **Mutfağa Gönder**.

## Backend
Aynı Laravel API (`packages`/`apps/api`). Uçlar: `auth/login`, `waiter/tables`,
`waiter/notifications`, `waiter/order-items/{id}/served`, `waiter/sessions/{id}/ack`,
`admin/products|categories`, `admin/pos/orders` (GET/POST), `admin/pos/orders/{id}/items`.
Rol: `waiter` (+ plan `waiter_app`/`ordering`). Menü okuma uçları `role:manager,cashier,waiter`.

## Çalıştırma
```bash
# monorepo kökünden bir kez:
pnpm install

# API'yi ayağa kaldır (apps/api):  php artisan serve --host 0.0.0.0 --port 8000
# API adresini ayarla:
cp apps/mobile-waiter/.env.example apps/mobile-waiter/.env
#   simülatör: http://localhost:8000   (Android emülatör: http://10.0.2.2:8000)
#   fiziksel cihaz: http://<LAN-IP>:8000  (aynı wifi)

cd apps/mobile-waiter
pnpm start            # Expo Dev Server (QR ile Expo Go / dev client)
# pnpm ios / pnpm android  → native run (Xcode/Android SDK gerekir)
```

## Build (EAS) — yalnızca istenince
`eas build --profile preview --platform android` (APK) / `--platform ios`.
`app.json`: bundle `com.comiqr.waiter`. EAS projectId `eas init` ile atanır.

## Notlar
- Token `expo-secure-store`'da (`comiqr.waiter.auth`). 401 → otomatik logout.
- pnpm monorepo: Metro `metro.config.js`'te `watchFolders` + `nodeModulesPaths` ile ayarlı; RN pin'leri kök `package.json` `pnpm.overrides`'ta (nativewind 4.2.3, expo-asset 12.0.13, css-interop 0.2.3, expo-modules-autolinking 3.0.25 — diğer Expo app'lerdeki açılış crash'lerini önlemek için).
