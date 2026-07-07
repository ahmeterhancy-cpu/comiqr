<?php

namespace App\Support\Campaigns;

use App\Models\Campaign;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * SMS campaign delivery via a Turkish bulk-SMS HTTP gateway (Telsim/NetGSM-style
 * user+password form post). Active only when TELSIM_SMS_URL + credentials are set;
 * the exact endpoint stays configurable so no provider URL is hard-coded wrong.
 * Fire-and-forget.
 */
class SmsChannel implements CampaignChannel
{
    public function __construct(
        private string $endpoint,
        private string $user,
        private string $pass,
        private ?string $header = null,
    ) {}

    public function deliver(Campaign $campaign, string $recipient, ?string $name): bool
    {
        try {
            $res = Http::asForm()->timeout(10)->post($this->endpoint, array_filter([
                'user' => $this->user,
                'password' => $this->pass,
                'gsm' => preg_replace('/\D/', '', $recipient),
                'text' => strip_tags($campaign->body ?: $campaign->name),
                'header' => $this->header,
            ], fn ($v) => $v !== null && $v !== ''));

            if (! $res->successful()) {
                Log::warning('campaign.sms.failed', ['campaign' => $campaign->id, 'status' => $res->status()]);
            }

            return $res->successful();
        } catch (\Throwable $e) {
            Log::warning('campaign.sms.error', ['campaign' => $campaign->id, 'error' => $e->getMessage()]);

            return false;
        }
    }
}
