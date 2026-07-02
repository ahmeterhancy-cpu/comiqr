<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A returning customer (Faz 2, M8, docs/05 §5.7). Phone/email are encrypted at
 * rest (KVKK); phone_hash allows lookup without decryption.
 */
class Customer extends Model
{
    /** @use HasFactory<\Database\Factories\CustomerFactory> */
    use BelongsToTenant, HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'phone', 'phone_hash', 'name', 'email', 'locale',
        'consent_json', 'first_seen_at', 'last_seen_at', 'total_orders', 'total_spend',
    ];

    protected $hidden = ['phone', 'email', 'phone_hash'];

    protected function casts(): array
    {
        return [
            'phone' => 'encrypted',
            'email' => 'encrypted',
            'consent_json' => 'array',
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'total_spend' => 'decimal:2',
        ];
    }

    public static function normalizePhone(string $phone): string
    {
        return preg_replace('/[^0-9+]/', '', $phone) ?? $phone;
    }

    public static function hashPhone(string $phone): string
    {
        return hash('sha256', self::normalizePhone($phone));
    }

    public function loyaltyAccount(): HasOne
    {
        return $this->hasOne(LoyaltyAccount::class);
    }

    /** Masked phone for panel display (KVKK — minimise exposure). */
    public function maskedPhone(): ?string
    {
        $phone = $this->phone;
        if (! $phone) {
            return null;
        }

        return substr($phone, 0, 4).str_repeat('•', max(0, strlen($phone) - 6)).substr($phone, -2);
    }
}
