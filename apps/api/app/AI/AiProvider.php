<?php

namespace App\AI;

/**
 * Provider-agnostic text AI contract (docs/04 §4.7). Anthropic is the default;
 * swapping providers is a new implementation bound in AppServiceProvider.
 */
interface AiProvider
{
    /** Complete a prompt and return plain text. */
    public function complete(string $system, string $prompt): string;

    /** Whether the provider is configured/usable. */
    public function isConfigured(): bool;
}
