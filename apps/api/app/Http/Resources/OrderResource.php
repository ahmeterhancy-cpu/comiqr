<?php

namespace App\Http\Resources;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Order */
class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'table_session_id' => $this->table_session_id,
            'source' => $this->source,
            'type' => $this->type,
            'charged_to_room' => (bool) $this->charged_to_room,
            'contact_phone' => $this->contact_phone,
            'address' => $this->address,
            'status' => $this->status,
            'payment_status' => $this->payment_status,
            'reviewed' => $this->whenLoaded('review', fn () => $this->review !== null),
            'subtotal' => $this->subtotal,
            'discount_total' => $this->discount_total,
            'tip_total' => $this->tip_total,
            'tax_total' => $this->tax_total,
            'grand_total' => $this->grand_total,
            // Money collected toward the order — principals plus tips (matches the
            // outstanding balance the POS shows: grand_total - paid_total).
            // Prefer an eager-loaded payments relation (list contexts) to avoid an
            // N+1; fall back to a single aggregate query for single-order responses.
            'paid_total' => $this->relationLoaded('payments')
                ? round($this->payments->where('status', 'paid')->sum(fn ($p) => (float) $p->amount + (float) $p->tip_amount), 2)
                : (float) $this->payments()->where('status', 'paid')
                    ->selectRaw('COALESCE(SUM(amount + tip_amount), 0) as c')->value('c'),
            'note' => $this->note,
            'placed_at' => $this->placed_at,
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($i) => [
                'id' => $i->id,
                'product_id' => $i->product_id,
                'product_name' => $i->relationLoaded('product') ? $i->product?->name : null,
                'variant_id' => $i->variant_id,
                'quantity' => $i->quantity,
                'unit_price' => $i->unit_price,
                'discount_total' => $i->discount_total,
                'modifiers' => $i->modifiers_json ?? [],
                'line_total' => $i->line_total,
                'status' => $i->status,
                'note' => $i->note,
            ])),
        ];
    }
}
