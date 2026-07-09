<?php

namespace App\AI;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * DeepSeek text provider — OpenAI-compatible Chat Completions (docs/04 §4.7).
 * Text-only: DeepSeek does not accept image input, so menu photo-import falls
 * back to a separate {@see VisionProvider} (see AppServiceProvider + AiService).
 */
class DeepSeekProvider implements AiProvider
{
    public function __construct(
        protected ?string $apiKey,
        protected string $model = 'deepseek-v4-flash',
        protected string $baseUrl = 'https://api.deepseek.com',
        protected int $maxTokens = 1024,
    ) {}

    public function isConfigured(): bool
    {
        return ! empty($this->apiKey);
    }

    public function complete(string $system, string $prompt): string
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('DeepSeek API key is not configured.');
        }

        $response = Http::withToken($this->apiKey)
            ->timeout(60)
            ->post(rtrim($this->baseUrl, '/').'/chat/completions', [
                'model' => $this->model,
                'max_tokens' => $this->maxTokens,
                'messages' => [
                    ['role' => 'system', 'content' => $system],
                    ['role' => 'user', 'content' => $prompt],
                ],
            ]);

        if ($response->failed()) {
            throw new RuntimeException('AI request failed: '.$response->status());
        }

        return trim((string) $response->json('choices.0.message.content', ''));
    }
}
