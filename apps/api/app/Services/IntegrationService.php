<?php

namespace App\Services;

use App\Models\Integration;
use App\Models\Order;
use App\Support\Integrations\IntegrationAdapterManager;

/**
 * Fans domain events out to a tenant's active external integrations (Faz 2).
 * Best-effort: adapters never throw, and a per-integration failure does not
 * affect the others or the originating request.
 */
class IntegrationService
{
    public function __construct(private IntegrationAdapterManager $adapters) {}

    /** Push a newly placed order to POS/ERP/delivery integrations. */
    public function orderPlaced(Order $order): void
    {
        $integrations = Integration::withoutTenancy()
            ->where('tenant_id', $order->tenant_id)
            ->where('is_active', true)
            ->whereIn('type', Integration::ORDER_TYPES)
            ->get();

        if ($integrations->isEmpty()) {
            return;
        }

        $payload = $this->orderPayload($order);

        foreach ($integrations as $integration) {
            if ($this->adapters->for($integration->provider)->push($integration, 'order.placed', $payload)) {
                $integration->forceFill(['last_synced_at' => now()])->saveQuietly();
            }
        }
    }

    /** Send a connectivity ping through the integration's adapter. */
    public function ping(Integration $integration): bool
    {
        return $this->adapters->for($integration->provider)->push($integration, 'ping', [
            'integration_id' => $integration->id,
            'at' => now()->toIso8601String(),
        ]);
    }

    /** @return array<string,mixed> */
    private function orderPayload(Order $order): array
    {
        $order->loadMissing('items.product:id,name,external_pos_id');

        return [
            'order_id' => $order->id,
            'branch_id' => $order->branch_id,
            'status' => $order->status,
            'grand_total' => (float) $order->grand_total,
            'placed_at' => optional($order->placed_at)->toIso8601String(),
            'items' => $order->items->map(fn ($i) => [
                'product_id' => $i->product_id,
                'external_pos_id' => $i->product?->external_pos_id,
                'name' => $i->product?->name,
                'quantity' => $i->quantity,
                'unit_price' => (float) $i->unit_price,
                'modifiers' => $i->modifiers_json ?? [],
            ])->values(),
        ];
    }
}
