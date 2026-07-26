<?php

namespace App\Payments;

use App\Models\Payment;
use Illuminate\Support\Str;

/**
 * Physical POS card terminal (self-service kiosk, M16). The guest orders on the
 * kiosk and pays by tapping/inserting a card on the attached payment terminal.
 *
 * SIMULATION mode (default, `mode=simulate`) auto-approves so the demo kiosk runs
 * end-to-end without hardware.
 *
 * REAL PROVIDER SEAM (`mode=live`): a working integration is provider-specific —
 * `initiate()` would push the amount to the linked terminal (via the acquirer's
 * cloud API or a local ECR/OPI protocol, keyed by a terminal id in $config) and
 * return a PENDING session; the terminal then reports the card result, which we
 * confirm through the webhook methods below. Plug the provider (Ingenico cloud,
 * iyzico, Tiko-terminal, PAX, …) in here once merchant credentials exist — no
 * card data ever touches the app.
 */
class TerminalGateway implements PaymentGateway
{
    /** @param array<string,mixed> $config */
    public function __construct(private array $config = []) {}

    public function name(): string
    {
        return 'terminal';
    }

    public function initiate(Payment $payment, array $context = []): PaymentSession
    {
        $mode = $this->config['mode'] ?? 'simulate';

        if ($mode === 'live') {
            // TODO(provider): call the terminal provider API with the amount +
            // configured terminal id, return PaymentSession::completed only after
            // the webhook confirms the card was approved.
            throw new \RuntimeException('Terminal gateway is in live mode but no provider adapter is configured.');
        }

        // Simulation: the physical card interaction is faked on the kiosk client;
        // the payment completes immediately here.
        return PaymentSession::completed('term_'.Str::lower(Str::random(16)));
    }

    public function verifyWebhook(array $payload, ?string $signature = null): bool
    {
        return false; // real provider: verify the terminal/acquirer signature
    }

    public function referenceFrom(array $payload): ?string
    {
        return $payload['ref'] ?? null;
    }

    public function isSuccessful(array $payload): bool
    {
        return ($payload['status'] ?? null) === 'approved';
    }
}
