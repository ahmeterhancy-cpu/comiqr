<?php

return [
    // Text AI provider (chatbot, product copy, translate, insights, reviews):
    // 'deepseek' (default) | 'anthropic'.
    'provider' => env('AI_PROVIDER', 'deepseek'),

    'deepseek' => [
        'key' => env('DEEPSEEK_API_KEY'),
        // deepseek-v4-flash (cheap/high-volume) | deepseek-v4-pro (stronger reasoning).
        'model' => env('DEEPSEEK_MODEL', 'deepseek-v4-flash'),
        'base_url' => env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
        'max_tokens' => (int) env('DEEPSEEK_MAX_TOKENS', 1024),
    ],

    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'model' => env('ANTHROPIC_MODEL', 'claude-sonnet-5'),
        'max_tokens' => (int) env('ANTHROPIC_MAX_TOKENS', 1024),
    ],

    // Image/PDF menu photo-import needs a vision model. DeepSeek is text-only, so
    // this falls back to Anthropic when ANTHROPIC_API_KEY is set; otherwise import
    // is disabled (503). Set to 'deepseek' only once DeepSeek ships a vision model.
    'vision' => env('AI_VISION_PROVIDER', 'anthropic'),
];
