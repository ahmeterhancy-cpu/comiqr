<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** A table called a waiter (docs/04 §4.4). Waiter app subscribes to the channel. */
class WaiterCalled implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $branchId,
        public int $tableId,
        public string $tableCode,
    ) {}

    /** @return array<int,PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("branch.{$this->branchId}.waiter")];
    }

    public function broadcastWith(): array
    {
        return ['type' => 'waiter_called', 'table_id' => $this->tableId, 'table_code' => $this->tableCode];
    }
}
