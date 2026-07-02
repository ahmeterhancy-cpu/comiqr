<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A product was 86'd or restored (docs/04 §4.4). The menu reflects it instantly.
 */
class ItemEightySixed implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $branchId,
        public int $productId,
        public bool $available, // true = restored, false = 86'd
    ) {}

    /** @return array<int,PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("branch.{$this->branchId}.kds")];
    }

    public function broadcastWith(): array
    {
        return ['product_id' => $this->productId, 'available' => $this->available];
    }
}
