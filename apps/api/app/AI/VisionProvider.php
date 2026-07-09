<?php

namespace App\AI;

/**
 * Optional image/PDF capability for an {@see AiProvider}. Kept separate so text-only
 * providers (and the in-memory test fakes) don't have to implement it. AiService
 * checks `instanceof VisionProvider` before an image task.
 */
interface VisionProvider
{
    /**
     * Complete a prompt that includes image/PDF inputs and return plain text.
     *
     * @param  array<int,array{type:string,media_type:string,data:string}>  $media
     *         base64 items — type 'image' (jpeg/png/webp) or 'document' (pdf)
     */
    public function completeWithImages(string $system, string $prompt, array $media, int $maxTokens = 4096): string;
}
