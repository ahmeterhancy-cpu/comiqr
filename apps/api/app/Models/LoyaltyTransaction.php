<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A loyalty ledger entry (Faz 2, M8, docs/05 §5.7). Scoped via its account.
 */
class LoyaltyTransaction extends Model
{
    public $timestamps = false;

    protected $fillable = ['loyalty_account_id', 'type', 'points', 'order_id', 'meta_json', 'created_at'];

    protected function casts(): array
    {
        return ['meta_json' => 'array', 'created_at' => 'datetime'];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(LoyaltyAccount::class, 'loyalty_account_id');
    }
}
