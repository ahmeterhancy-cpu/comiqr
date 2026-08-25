<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Kiracıdan bağımsız platform ayarı (anahtar → JSON).
 *
 * Okuma yolu landing sayfasının her isteğinde çalıştığı için `all()` tek
 * sorguda önek eşleşen anahtarları döndürür; çağıran taraf N+1'e düşmesin.
 */
class PlatformSetting extends Model
{
    protected $fillable = ['key', 'value_json'];

    protected $casts = ['value_json' => 'array'];

    public static function get(string $key, mixed $default = null): mixed
    {
        return static::query()->where('key', $key)->value('value_json') ?? $default;
    }

    public static function put(string $key, mixed $value): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value_json' => $value]);
    }

    /** Önekle başlayan tüm ayarlar: `landing.content.` → ['tr' => [...], 'en' => [...]]. */
    public static function byPrefix(string $prefix): array
    {
        return static::query()
            ->where('key', 'like', $prefix.'%')
            ->pluck('value_json', 'key')
            ->mapWithKeys(fn ($value, $key) => [substr($key, strlen($prefix)) => $value])
            ->all();
    }
}
