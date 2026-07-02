<?php

namespace App\Http\Resources;

use App\Models\Table;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Table */
class TableResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'branch_id' => $this->branch_id,
            'dining_area_id' => $this->dining_area_id,
            'code' => $this->code,
            'qr_token' => $this->qr_token,
            // Path the QR should encode on the customer PWA.
            'menu_path' => "/m/{$this->qr_token}",
            'is_active' => $this->is_active,
            'has_open_session' => $this->whenLoaded('sessions', fn () => $this->sessions->contains('status', 'open')),
        ];
    }
}
