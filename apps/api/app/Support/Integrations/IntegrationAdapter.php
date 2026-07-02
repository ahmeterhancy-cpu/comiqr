<?php

namespace App\Support\Integrations;

use App\Models\Integration;

/**
 * Delivers a payload to one external system (Faz 2). Real provider drivers
 * (Simpra/Adisyo/Yemeksepeti/…) implement this; the default is a generic
 * webhook. Best-effort: a false return means "not delivered", never throws.
 */
interface IntegrationAdapter
{
    /** Push a domain event payload (e.g. an order) to the integration. */
    public function push(Integration $integration, string $event, array $payload): bool;
}
