<?php

namespace App\AI;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Anthropic Messages API text provider (docs/00, docs/04 §4.7). Uses the latest
 * Claude model by default; configure via config/ai.php.
 */
class AnthropicProvider implements AiProvider
{
    public function __construct(
        protected ?string $apiKey,
        protected string $model = 'claude-sonnet-5',
        protected int $maxTokens = 1024,
    ) {}

    public function isConfigured(): bool
    {
        return ! empty($this->apiKey);
    }

    public function complete(string $system, string $prompt): string
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Anthropic API key is not configured.');
        }

        $response = Http::withHeaders([
            'x-api-key' => $this->apiKey,
            'anthropic-version' => '2023-06-01',
            'content-type' => 'application/json',
        ])->timeout(30)->post('https://api.anthropic.com/v1/messages', [
            'model' => $this->model,
            'max_tokens' => $this->maxTokens,
            'system' => $system,
            'messages' => [['role' => 'user', 'content' => $prompt]],
        ]);

        if ($response->failed()) {
            throw new RuntimeException('AI request failed: '.$response->status());
        }

        return trim((string) $response->json('content.0.text', ''));
    }
}
