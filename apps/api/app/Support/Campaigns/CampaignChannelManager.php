<?php

namespace App\Support\Campaigns;

/**
 * Resolves the {@see CampaignChannel} driver for a channel name (Faz 2, M8).
 * Every channel currently maps to {@see LogChannel}; real gateway drivers
 * (Brevo/Telsim/WhatsApp/FCM) register here without touching CampaignService.
 */
class CampaignChannelManager
{
    /** @var array<string,CampaignChannel> */
    private array $drivers = [];

    public function __construct(private LogChannel $fallback) {}

    /** Register a real driver for a channel (e.g. 'email' => BrevoChannel). */
    public function extend(string $channel, CampaignChannel $driver): void
    {
        $this->drivers[$channel] = $driver;
    }

    public function for(string $channel): CampaignChannel
    {
        return $this->drivers[$channel] ?? $this->fallback;
    }
}
