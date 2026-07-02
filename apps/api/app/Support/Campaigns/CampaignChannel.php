<?php

namespace App\Support\Campaigns;

use App\Models\Campaign;

/**
 * A delivery channel for a campaign (Faz 2, M8). Real drivers wrap Brevo
 * (e-mail), Telsim (SMS), WhatsApp Cloud API or FCM (push); the local/default
 * driver logs. Deliveries are fire-and-forget — a false return just means this
 * recipient was skipped, it never aborts the batch (mirrors the payment/callback
 * abstraction, [[project_callback_fire_and_forget]]).
 */
interface CampaignChannel
{
    /** Deliver one message; returns true when accepted for sending. */
    public function deliver(Campaign $campaign, string $recipient, ?string $name): bool;
}
