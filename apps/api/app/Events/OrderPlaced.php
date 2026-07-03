<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast when a new order is placed (docs/04 §4.4/§4.5). KDS and the waiter
 * app subscribe to the branch channel to react in real time (M6/M10).
 */
class OrderPlaced implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Order $order) {}

    /** @return array<int,PrivateChannel> */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("branch.{$this->order->branch_id}.orders"),
            new PrivateChannel("branch.{$this->order->branch_id}.kds"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'OrderPlaced';
    }

    public function broadcastWith(): array
    {
        return [
            'order_id' => $this->order->id,
            'table_session_id' => $this->order->table_session_id,
            'status' => $this->order->status,
            'grand_total' => $this->order->grand_total,
            'placed_at' => $this->order->placed_at,
        ];
    }
}
