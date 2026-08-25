<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Pazarlama sayfasının panelden yönetilen kısmı.
 *
 * Burada tutulan şey tam içerik DEĞİL, çeviri dosyalarının üzerine yazılan
 * alanlar. Sayfayı basan taraf (web-admin) dosyadaki varsayılanı okur ve bu
 * cevabı üstüne bindirir; kayıt yoksa sayfa bugünkü hâliyle çıkar. Bu yüzden
 * yeni bir dil ya da yeni bir bölüm eklendiğinde panelde karşılığı olmasa bile
 * sayfa eksik kalmaz — CMS'e taşınmanın en riskli yanı budur.
 *
 * Anahtar biçimi çeviri ağacının nokta yoludur: `hero.title1`,
 * `sections.finance.points.2`, `faq.items.0.q`.
 */
class LandingController extends Controller
{
    /** Landing'in her isteğinde okunur; sayfa basımını yavaşlatmasın diye kısa süre önbellekte. */
    private const CACHE_TTL = 60;

    private const CONTENT_PREFIX = 'landing.content.';

    private const MEDIA_KEY = 'landing.media';

    /** Panelden yüklenebilen görseller ve ne işe yaradıkları. */
    private const MEDIA_SLOTS = ['heroPhone', 'ogImage', 'logo'];

    /** Herkese açık: sayfayı basan sunucu okur. */
    public function show(): JsonResponse
    {
        // Önbelleğe YALNIZ dizi konur: stdClass serileştirilip geri okunduğunda
        // `__PHP_Incomplete_Class` olarak dönüyordu. Nesneye çevirme, cevabı
        // kurarken yapılır — boş sözlük JSON'da `{}` olsun diye.
        $payload = cache()->remember('landing.payload', self::CACHE_TTL, fn () => [
            'content' => PlatformSetting::byPrefix(self::CONTENT_PREFIX),
            'media' => PlatformSetting::get(self::MEDIA_KEY, []),
        ]);

        return response()->json(['data' => [
            'content' => (object) $payload['content'],
            'media' => (object) $payload['media'],
        ]]);
    }

    /** Süperadmin: bir dilin üzerine yazılan alanları döndürür (varsayılanlar panelde). */
    public function edit(string $locale): JsonResponse
    {
        return response()->json(['data' => [
            'locale' => $locale,
            'overrides' => PlatformSetting::get(self::CONTENT_PREFIX.$locale, (object) []),
            'media' => PlatformSetting::get(self::MEDIA_KEY, (object) []),
        ]]);
    }

    /**
     * Süperadmin: bir dilin alanlarını kaydeder.
     *
     * Boş dizeyle gelen alan SİLİNİR — panelde "varsayılana dön" budur. Boş
     * dizeyi saklasaydık sayfa çeviri yerine boşluk basardı.
     */
    public function update(Request $request, string $locale): JsonResponse
    {
        $data = $request->validate([
            'overrides' => ['present', 'array'],
            'overrides.*' => ['nullable', 'string', 'max:2000'],
        ]);

        $overrides = collect($data['overrides'])
            ->reject(fn ($value) => $value === null || trim($value) === '')
            ->all();

        PlatformSetting::put(self::CONTENT_PREFIX.$locale, $overrides);
        cache()->forget('landing.payload');

        return response()->json(['data' => ['locale' => $locale, 'overrides' => (object) $overrides]]);
    }

    /** Süperadmin: landing görseli yükler (hero telefon görüntüsü, OG görseli, logo). */
    public function uploadMedia(Request $request): JsonResponse
    {
        $data = $request->validate([
            'slot' => ['required', 'in:'.implode(',', self::MEDIA_SLOTS)],
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $path = 'landing/'.$data['slot'].'-'.Str::uuid().'.'.$request->file('image')->extension();
        Storage::disk('public')->put($path, $request->file('image')->getContent());

        $media = PlatformSetting::get(self::MEDIA_KEY, []);
        $media[$data['slot']] = url('/v1/media/'.$path);
        PlatformSetting::put(self::MEDIA_KEY, $media);
        cache()->forget('landing.payload');

        return response()->json(['data' => ['slot' => $data['slot'], 'url' => $media[$data['slot']]]], 201);
    }

    /** Süperadmin: görseli kaldırır — sayfa yerleşik görseline döner. */
    public function deleteMedia(string $slot): JsonResponse
    {
        abort_unless(in_array($slot, self::MEDIA_SLOTS, true), 404);

        $media = PlatformSetting::get(self::MEDIA_KEY, []);
        unset($media[$slot]);
        PlatformSetting::put(self::MEDIA_KEY, $media);
        cache()->forget('landing.payload');

        return response()->json(['data' => ['slot' => $slot, 'url' => null]]);
    }
}
