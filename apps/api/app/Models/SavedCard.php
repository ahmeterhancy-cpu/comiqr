<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A customer's tokenised card (Faz 2, M20). Holds only the Tiko token (CardId) +
 * a display alias/last4 — never the PAN. Used for one-tap repeat online payment.
 */
class SavedCard extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'customer_id', 'tiko_card_id', 'alias', 'last4'];

    protected $hidden = ['tiko_card_id'];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
