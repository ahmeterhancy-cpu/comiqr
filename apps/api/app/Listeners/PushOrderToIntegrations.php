<?php

namespace App\Listeners;

use App\Events\OrderPlaced;
use App\Services\IntegrationService;

/**
 * Bridges a placed order to the tenant's external integrations (Faz 2). Runs
 * synchronously and best-effort; adapters swallow their own failures so a slow
 * or down external system never breaks order placement.
 */
class PushOrderToIntegrations
{
    public function __construct(private IntegrationService $integrations) {}

    public function handle(OrderPlaced $event): void
    {
        $this->integrations->orderPlaced($event->order);
    }
}
