<?php

namespace App\Payments;

/**
 * The result of initiating a payment (docs/04 §4.6). Either the payment is
 * already complete (cash at counter) or the customer must be sent to a
 * redirect/iframe hosted by the gateway (PayTR/Tiko) — we never handle card data.
 */
final class PaymentSession
{
    private function __construct(
        public readonly string $kind,     // completed | redirect | iframe | form
        public readonly ?string $url,
        public readonly string $ref,
        public readonly array $meta = [],
    ) {}

    public static function completed(string $ref): self
    {
        return new self('completed', null, $ref);
    }

    public static function redirect(string $url, string $ref, array $meta = []): self
    {
        return new self('redirect', $url, $ref, $meta);
    }

    /**
     * Auto-submitting form POST to the gateway. `fields` are hidden inputs the
     * browser posts; the client collects any card fields itself so card data
     * never touches our server (Tiko pay3d, docs/04 §4.6).
     *
     * @param  array<string,string>  $fields
     */
    public static function form(string $url, array $fields, string $ref, array $meta = []): self
    {
        return new self('form', $url, $ref, array_merge($meta, ['fields' => $fields]));
    }

    public static function iframe(string $url, string $ref, array $meta = []): self
    {
        return new self('iframe', $url, $ref, $meta);
    }

    public function isCompleted(): bool
    {
        return $this->kind === 'completed';
    }

    public function toArray(): array
    {
        return array_filter([
            'kind' => $this->kind,
            'url' => $this->url,
            'ref' => $this->ref,
            'meta' => $this->meta ?: null,
        ], fn ($v) => $v !== null);
    }
}
