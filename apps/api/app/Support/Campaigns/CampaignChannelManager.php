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
        return $this->drivers[$channel] ?? $this->resolve($channel) ?? $this->fallback;
    }

    /**
     * Build the real gateway driver for a channel when its credentials are set;
     * otherwise null → the caller falls back to LogChannel. Resolved lazily so
     * config changes (and tests) take effect without re-registration.
     */
    protected function resolve(string $channel): ?CampaignChannel
    {
        return match ($channel) {
            'email' => config('services.brevo.key')
                ? new BrevoChannel(config('services.brevo.key'), (string) config('mail.from.address'), (string) config('mail.from.name'))
                : null,
            'sms' => (config('services.telsim.url') && config('services.telsim.user'))
                ? new SmsChannel(config('services.telsim.url'), config('services.telsim.user'), (string) config('services.telsim.pass'), config('services.telsim.header'))
                : null,
            'whatsapp' => (config('services.whatsapp.token') && config('services.whatsapp.phone_id'))
                ? new WhatsAppChannel(config('services.whatsapp.token'), config('services.whatsapp.phone_id'))
                : null,
            default => null,
        };
    }
}
