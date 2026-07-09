<?php

use App\AI\DeepSeekProvider;
use Illuminate\Support\Facades\Http;

it('calls the DeepSeek chat completions API (OpenAI shape) and returns the content', function () {
    Http::fake([
        'api.deepseek.com/*' => Http::response(['choices' => [['message' => ['content' => 'Merhaba dünya']]]], 200),
    ]);

    $provider = new DeepSeekProvider('sk-test', 'deepseek-v4-flash', 'https://api.deepseek.com', 512);

    expect($provider->isConfigured())->toBeTrue();
    expect($provider->complete('Sistem promptu', 'Kullanıcı sorusu'))->toBe('Merhaba dünya');

    Http::assertSent(fn ($request) => $request->url() === 'https://api.deepseek.com/chat/completions'
        && $request->hasHeader('Authorization', 'Bearer sk-test')
        && $request['model'] === 'deepseek-v4-flash'
        && $request['max_tokens'] === 512
        && $request['messages'][0] === ['role' => 'system', 'content' => 'Sistem promptu']
        && $request['messages'][1] === ['role' => 'user', 'content' => 'Kullanıcı sorusu']);
});

it('throws when the DeepSeek API fails', function () {
    Http::fake(['api.deepseek.com/*' => Http::response(['error' => 'nope'], 500)]);

    expect(fn () => (new DeepSeekProvider('sk-test'))->complete('s', 'p'))->toThrow(RuntimeException::class);
});

it('reports unconfigured without a key', function () {
    expect((new DeepSeekProvider(null))->isConfigured())->toBeFalse();
});
