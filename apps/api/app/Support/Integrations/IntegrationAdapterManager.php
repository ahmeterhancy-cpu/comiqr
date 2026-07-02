<?php

namespace App\Support\Integrations;

/**
 * Resolves the {@see IntegrationAdapter} for a provider (Faz 2). Unknown
 * providers fall back to the generic {@see WebhookAdapter} (POST to the
 * configured endpoint) so most POS/delivery systems work without a bespoke
 * driver; register real drivers with extend().
 */
class IntegrationAdapterManager
{
    /** @var array<string,IntegrationAdapter> */
    private array $drivers;

    public function __construct(WebhookAdapter $webhook, LogAdapter $log)
    {
        $this->drivers = [
            'webhook' => $webhook,
            'log' => $log,
        ];
        $this->default = $webhook;
    }

    private IntegrationAdapter $default;

    public function extend(string $provider, IntegrationAdapter $adapter): void
    {
        $this->drivers[$provider] = $adapter;
    }

    public function for(string $provider): IntegrationAdapter
    {
        return $this->drivers[$provider] ?? $this->default;
    }
}
