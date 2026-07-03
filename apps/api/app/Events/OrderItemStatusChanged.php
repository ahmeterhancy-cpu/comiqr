<?php

namespace App\Events;

use App\Models\OrderItem;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * An order item changed status (accepted→preparing→ready→served) (docs/04 §4.4).
 * Broadcasts to the branch (KDS/waiter) and the customer's table channel so the
 * live tracker updates ("preparing → ready").
 */
class OrderItemStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public OrderItem $item,
        public int $branchId,
        public ?int $tableSessionId,
    ) {}

    /** @return array<int,PrivateChannel> */
    public function broadcastOn(): array
    {
        $channels = [new PrivateChannel("branch.{$this->branchId}.orders")];

        if ($this->tableSessionId) {
            $channels[] = new PrivateChannel("table.{$this->tableSessionId}");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'OrderItemStatusChanged';
    }

    public function broadcastWith(): array
    {
        return [
            'order_item_id' => $this->item->id,
            'order_id' => $this->item->order_id,
            'status' => $this->item->status,
        ];
    }
}
