<?php

namespace App\Support\Campaigns;

use App\Models\Campaign;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * WhatsApp campaign delivery via the Meta Cloud API. Active only when
 * WHATSAPP_TOKEN + WHATSAPP_PHONE_ID are set. NOTE: outbound marketing outside the
 * 24h customer-service window requires an approved message template — free-text
 * (used here) only reaches recipients inside an open session; template support is a
 * follow-up. Fire-and-forget.
 */
class WhatsAppChannel implements CampaignChannel
{
    public function __construct(
        private string $token,
        private string $phoneId,
    ) {}

    public function deliver(Campaign $campaign, string $recipient, ?string $name): bool
    {
        try {
            $res = Http::withToken($this->token)->timeout(10)
                ->post("https://graph.facebook.com/v20.0/{$this->phoneId}/messages", [
                    'messaging_product' => 'whatsapp',
                    'to' => preg_replace('/\D/', '', $recipient),
                    'type' => 'text',
                    'text' => ['body' => strip_tags($campaign->body ?: $campaign->name)],
                ]);

            if (! $res->successful()) {
                Log::warning('campaign.whatsapp.failed', ['campaign' => $campaign->id, 'status' => $res->status()]);
            }

            return $res->successful();
        } catch (\Throwable $e) {
            Log::warning('campaign.whatsapp.error', ['campaign' => $campaign->id, 'error' => $e->getMessage()]);

            return false;
        }
    }
}
