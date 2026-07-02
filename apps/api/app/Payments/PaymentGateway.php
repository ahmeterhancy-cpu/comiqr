<?php

namespace App\Payments;

use App\Models\Payment;

/**
 * Payment gateway contract (docs/04 §4.6). Adding a provider = a new class; no
 * card data ever reaches the app (redirect/iframe/tokenisation).
 */
interface PaymentGateway
{
    public function name(): string;

    /** Start a payment for the given (initiated) payment row. */
    public function initiate(Payment $payment): PaymentSession;

    /** Verify a webhook is authentic (signature/hash). */
    public function verifyWebhook(array $payload, ?string $signature = null): bool;

    /** The gateway reference the webhook refers to. */
    public function referenceFrom(array $payload): ?string;

    /** Did the webhook report a successful payment? */
    public function isSuccessful(array $payload): bool;
}
