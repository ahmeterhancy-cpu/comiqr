<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A kitchen display station within a branch (M6, docs/05 §5.6).
 */
class KdsStation extends Model
{
    /** @use HasFactory<\Database\Factories\KdsStationFactory> */
    use BelongsToTenant, HasFactory;

    protected $fillable = ['tenant_id', 'branch_id', 'name', 'category_ids_json'];

    protected function casts(): array
    {
        return ['category_ids_json' => 'array'];
    }
}
