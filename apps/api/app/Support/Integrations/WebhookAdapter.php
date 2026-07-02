<?php

namespace App\Support\Integrations;

use App\Models\Integration;
use Illuminate\Support\Facades\Http;

/**
 * Generic HTTP webhook adapter (Faz 2). POSTs the payload as JSON to the
 * configured endpoint; when a secret is set, an HMAC-SHA256 signature is sent in
 * X-ComiQR-Signature so the receiver can verify authenticity.
 */
class WebhookAdapter implements IntegrationAdapter
{
    public function push(Integration $integration, string $event, array $payload): bool
    {
        $endpoint = $integration->config_json['endpoint'] ?? null;
        if (! $endpoint) {
            return false;
        }

        $body = ['event' => $event, 'data' => $payload];
        $request = Http::asJson()->timeout(5);

        if (! empty($integration->config_json['secret'])) {
            $signature = hash_hmac('sha256', json_encode($body), $integration->config_json['secret']);
            $request = $request->withHeaders(['X-ComiQR-Signature' => $signature]);
        }

        try {
            return $request->post($endpoint, $body)->successful();
        } catch (\Throwable) {
            return false;
        }
    }
}
