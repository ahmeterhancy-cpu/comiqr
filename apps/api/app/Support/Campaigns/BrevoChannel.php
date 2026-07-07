<?php

namespace App\Support\Campaigns;

use App\Models\Campaign;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * E-mail campaign delivery via Brevo (transactional email API). Active only when
 * BREVO_API_KEY is set (config/services.brevo.key); otherwise CampaignChannelManager
 * falls back to LogChannel. Fire-and-forget: a failed send returns false, never throws.
 */
class BrevoChannel implements CampaignChannel
{
    public function __construct(
        private string $apiKey,
        private string $fromEmail,
        private string $fromName,
    ) {}

    public function deliver(Campaign $campaign, string $recipient, ?string $name): bool
    {
        try {
            $res = Http::withHeaders(['api-key' => $this->apiKey, 'accept' => 'application/json'])
                ->timeout(10)
                ->post('https://api.brevo.com/v3/smtp/email', [
                    'sender' => ['email' => $this->fromEmail, 'name' => $this->fromName],
                    'to' => [['email' => $recipient, 'name' => $name ?? $recipient]],
                    'subject' => $campaign->subject ?: $campaign->name,
                    'htmlContent' => '<html><body>'.nl2br(e($campaign->body ?? '')).'</body></html>',
                ]);

            if (! $res->successful()) {
                Log::warning('campaign.brevo.failed', ['campaign' => $campaign->id, 'status' => $res->status()]);
            }

            return $res->successful();
        } catch (\Throwable $e) {
            Log::warning('campaign.brevo.error', ['campaign' => $campaign->id, 'error' => $e->getMessage()]);

            return false;
        }
    }
}
