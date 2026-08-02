<?php

namespace App\Listeners;

use App\Events\OrderPlaced;
use App\Services\PrintRouter;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Queues the station tickets for a placed order (Faz 4). Best-effort by design:
 * a venue with no printers, or a routing failure, must never stop a guest from
 * ordering — the ticket queue is an operational convenience, not part of the
 * money path.
 */
class PrintOrderTicket
{
    public function __construct(private PrintRouter $printers) {}

    public function handle(OrderPlaced $event): void
    {
        try {
            $this->printers->routeOrder($event->order);
        } catch (Throwable $e) {
            Log::warning('Print routing failed', ['order_id' => $event->order->id, 'error' => $e->getMessage()]);
        }
    }
}
