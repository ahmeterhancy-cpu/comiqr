<?php

namespace App\AI;

use RuntimeException;

/**
 * Fallback provider when no AI key is configured. Reports unconfigured and
 * refuses to fabricate content (the controller returns a clear 503 instead).
 */
class NullAiProvider implements AiProvider
{
    public function isConfigured(): bool
    {
        return false;
    }

    public function complete(string $system, string $prompt): string
    {
        throw new RuntimeException('AI provider is not configured.');
    }
}
