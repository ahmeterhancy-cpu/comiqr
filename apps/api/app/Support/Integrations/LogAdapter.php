<?php

namespace App\Support\Integrations;

use App\Models\Integration;
use Illuminate\Support\Facades\Log;

/** Records the intended push to the log. Fallback for providers without a driver. */
class LogAdapter implements IntegrationAdapter
{
    public function push(Integration $integration, string $event, array $payload): bool
    {
        Log::info('integration.push', [
            'integration_id' => $integration->id,
            'provider' => $integration->provider,
            'event' => $event,
        ]);

        return true;
    }
}
