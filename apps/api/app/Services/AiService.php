<?php

namespace App\Services;

use App\AI\AiProvider;
use App\Models\Product;

/**
 * AI text tasks over the menu (M7, docs/04 §4.7): appetising product copy and
 * menu translation. Provider-agnostic; the differentiating AI column alongside
 * the nutrition engine.
 */
class AiService
{
    private const LOCALE_NAMES = [
        'tr' => 'Turkish', 'en' => 'English', 'de' => 'German', 'ru' => 'Russian', 'ar' => 'Arabic',
    ];

    public function __construct(protected AiProvider $ai) {}

    public function isConfigured(): bool
    {
        return $this->ai->isConfigured();
    }

    /** Generate an appetising menu description for a product. */
    public function productCopy(Product $product, string $tone = 'appetizing', string $locale = 'tr'): string
    {
        $language = self::LOCALE_NAMES[$locale] ?? 'Turkish';

        $system = "You are a menu copywriter for restaurants. Write concise, {$tone}, "
            ."appetite-evoking menu descriptions in {$language}. One or two sentences, no emojis, "
            .'no pricing, no health claims.';

        $prompt = "Product name: {$product->name}\n"
            .($product->description ? "Current description: {$product->description}\n" : '')
            .'Write a better menu description.';

        return $this->ai->complete($system, $prompt);
    }

    /**
     * Translate a product's name + description into $locale.
     *
     * @return array{name:string,description:?string}
     */
    public function translateProduct(Product $product, string $locale): array
    {
        $language = self::LOCALE_NAMES[$locale] ?? $locale;

        $system = "You are a professional menu translator. Translate restaurant menu text into {$language}. "
            .'Keep dish names natural (do not translate proper/branded dish names literally when a known '
            .'equivalent exists). Return ONLY the translation, no notes.';

        $name = $this->ai->complete($system, "Translate this dish name: {$product->name}");
        $description = $product->description
            ? $this->ai->complete($system, "Translate this description: {$product->description}")
            : null;

        return ['name' => trim($name), 'description' => $description ? trim($description) : null];
    }

    /**
     * Menu-engineering advice from per-item sales + margin (AI ileri, Faz 3).
     *
     * @param  array<int,array{name:string,qty:int,revenue:float,margin:float}>  $items
     */
    public function menuInsights(array $items, string $currency = 'TRY', string $locale = 'tr'): string
    {
        $language = self::LOCALE_NAMES[$locale] ?? 'Turkish';

        $system = "You are a restaurant menu-engineering consultant. From per-item sales volume and "
            ."unit margin, give 3-6 concise, concrete, actionable recommendations in {$language} "
            .'(promote/reprice/reposition/remove). Short bullet points, no preamble.';

        $lines = array_map(
            fn (array $i) => "- {$i['name']}: {$i['qty']} adet, ciro {$i['revenue']} {$currency}, birim marj {$i['margin']} {$currency}",
            $items,
        );
        $prompt = "Menu performance (last 30 days):\n".implode("\n", $lines);

        return $this->ai->complete($system, $prompt);
    }

    /**
     * Summarise recent customer reviews: sentiment, themes, action items (Faz 3).
     *
     * @param  array<int,array{rating:int,comment:?string}>  $reviews
     */
    public function reviewSummary(array $reviews, string $locale = 'tr'): string
    {
        $language = self::LOCALE_NAMES[$locale] ?? 'Turkish';

        $system = "You analyse restaurant customer reviews. In {$language}, give: overall sentiment, "
            .'top positive themes, top complaints, and 2-3 concrete action items. Concise, bullet points.';

        $lines = array_map(
            fn (array $r) => "[{$r['rating']}/5] ".trim((string) ($r['comment'] ?? '')),
            array_slice($reviews, 0, 100),
        );
        $prompt = "Reviews:\n".implode("\n", $lines);

        return $this->ai->complete($system, $prompt);
    }
}
