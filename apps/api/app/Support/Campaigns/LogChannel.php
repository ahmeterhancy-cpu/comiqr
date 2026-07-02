<?php

namespace App\Support\Campaigns;

use App\Models\Campaign;
use Illuminate\Support\Facades\Log;

/**
 * Default campaign channel — records the intended delivery to the log. Used in
 * dev/local and as the fallback until the real gateway driver for a channel is
 * wired (Brevo/Telsim/WhatsApp/FCM).
 */
class LogChannel implements CampaignChannel
{
    public function deliver(Campaign $campaign, string $recipient, ?string $name): bool
    {
        Log::info('campaign.deliver', [
            'campaign_id' => $campaign->id,
            'channel' => $campaign->channel,
            'recipient' => $recipient,
        ]);

        return true;
    }
}
