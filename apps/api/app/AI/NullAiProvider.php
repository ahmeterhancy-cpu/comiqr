<?php

namespace App\AI;

use RuntimeException;

/**
 * Fallback provider when no AI key is configured. Reports unconfigured and
 * refuses to fabricate content (the controller returns a clear 503 instead).
 * Implements VisionProvider too so it can back the vision binding when unset.
 */
class NullAiProvider implements AiProvider, VisionProvider
{
    public function isConfigured(): bool
    {
        return false;
    }

    public function complete(string $system, string $prompt): string
    {
        throw new RuntimeException('AI provider is not configured.');
    }

    public function completeWithImages(string $system, string $prompt, array $media, int $maxTokens = 4096): string
    {
        throw new RuntimeException('AI provider is not configured.');
    }
}
