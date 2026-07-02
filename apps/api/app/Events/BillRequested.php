<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** A table requested the bill (docs/04 §4.4). Waiter app subscribes. */
class BillRequested implements ShouldBroadcast
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
        return ['type' => 'bill_requested', 'table_id' => $this->tableId, 'table_code' => $this->tableCode];
    }
}
