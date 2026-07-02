<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * A physical ordering point — table/room/sunbed/stand (M3, docs/05 §5.4).
 * Carries an unguessable qr_token used by the public menu to resolve the venue
 * and table without any auth (docs/04 §4.9 — POS-verifiable, spoof-resistant).
 */
class Table extends Model
{
    /** @use HasFactory<\Database\Factories\TableFactory> */
    use BelongsToTenant, HasFactory, SoftDeletes;

    protected $fillable = ['tenant_id', 'branch_id', 'dining_area_id', 'code', 'qr_token', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::creating(function (Table $table) {
            if (empty($table->qr_token)) {
                $table->qr_token = static::generateToken();
            }
        });
    }

    public static function generateToken(): string
    {
        do {
            $token = Str::random(40);
        } while (static::withoutTenancy()->where('qr_token', $token)->exists());

        return $token;
    }

    public function regenerateToken(): void
    {
        $this->update(['qr_token' => static::generateToken()]);
    }

    public function diningArea(): BelongsTo
    {
        return $this->belongsTo(DiningArea::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(TableSession::class);
    }

    public function openSession(): HasMany
    {
        return $this->sessions()->where('status', 'open');
    }
}
