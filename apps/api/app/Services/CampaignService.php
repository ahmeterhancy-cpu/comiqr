<?php

namespace App\Services;

use App\Models\Campaign;
use App\Models\Customer;
use App\Support\Campaigns\CampaignChannelManager;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Campaign delivery (Faz 2, M8, docs/05 §5.7). Resolves the audience, fans out
 * over the channel driver and records how many messages were accepted. Money is
 * not involved; delivery is best-effort (fire-and-forget per recipient).
 */
class CampaignService
{
    public function __construct(private CampaignChannelManager $channels) {}

    public function send(Campaign $campaign): Campaign
    {
        if ($campaign->isSent()) {
            throw ValidationException::withMessages(['status' => ['Campaign has already been sent.']]);
        }

        $driver = $this->channels->for($campaign->channel);
        $recipients = $this->recipients($campaign);

        $delivered = 0;
        foreach ($recipients as $customer) {
            $contact = $campaign->usesEmail() ? $customer->email : $customer->phone;
            if ($contact === null || $contact === '') {
                continue;
            }
            if ($driver->deliver($campaign, $contact, $customer->name)) {
                $delivered++;
            }
        }

        $campaign->update([
            'status' => 'sent',
            'recipient_count' => $recipients->count(),
            'sent_count' => $delivered,
            'sent_at' => now(),
        ]);

        return $campaign->refresh();
    }

    /**
     * Customers eligible for this campaign: the audience filter, restricted to
     * those reachable on the campaign's channel (e-mail address vs phone).
     *
     * @return Collection<int,Customer>
     */
    public function recipients(Campaign $campaign): Collection
    {
        return Customer::query()
            ->when($campaign->audience === 'min_points', function ($q) use ($campaign) {
                $min = $campaign->min_points ?? 0;
                $q->whereHas('loyaltyAccount', fn ($a) => $a->where('points_balance', '>=', $min));
            })
            ->when(
                $campaign->usesEmail(),
                fn ($q) => $q->whereNotNull('email'),
                fn ($q) => $q->whereNotNull('phone_hash'),
            )
            ->get();
    }
}
