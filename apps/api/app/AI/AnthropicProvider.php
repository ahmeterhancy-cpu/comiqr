<?php

namespace App\AI;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Anthropic Messages API text provider (docs/00, docs/04 §4.7). Uses the latest
 * Claude model by default; configure via config/ai.php.
 */
class AnthropicProvider implements AiProvider, VisionProvider
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
        return $this->request($system, $prompt, $this->maxTokens);
    }

    public function completeWithImages(string $system, string $prompt, array $media, int $maxTokens = 4096): string
    {
        $content = [['type' => 'text', 'text' => $prompt]];
        foreach ($media as $m) {
            $block = ($m['type'] ?? 'image') === 'document' ? 'document' : 'image';
            $content[] = [
                'type' => $block,
                'source' => ['type' => 'base64', 'media_type' => $m['media_type'], 'data' => $m['data']],
            ];
        }

        // Vision extraction is slower and produces more tokens than the text tasks.
        return $this->request($system, $content, $maxTokens, timeout: 90);
    }

    /** @param  string|array<int,mixed>  $userContent */
    private function request(string $system, string|array $userContent, int $maxTokens, int $timeout = 30): string
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Anthropic API key is not configured.');
        }

        $response = Http::withHeaders([
            'x-api-key' => $this->apiKey,
            'anthropic-version' => '2023-06-01',
            'content-type' => 'application/json',
        ])->timeout($timeout)->post('https://api.anthropic.com/v1/messages', [
            'model' => $this->model,
            'max_tokens' => $maxTokens,
            'system' => $system,
            'messages' => [['role' => 'user', 'content' => $userContent]],
        ]);

        if ($response->failed()) {
            throw new RuntimeException('AI request failed: '.$response->status());
        }

        return trim((string) $response->json('content.0.text', ''));
    }
}
