<?php

return [
    'provider' => env('AI_PROVIDER', 'anthropic'),

    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'model' => env('ANTHROPIC_MODEL', 'claude-sonnet-5'),
        'max_tokens' => (int) env('ANTHROPIC_MAX_TOKENS', 1024),
    ],
];
