<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Content translations via a sibling `*_translations` table (docs/05, CLAUDE.md
 * §i18n). Fallback chain: requested locale → tenant default → base column → 'en'.
 *
 * Implementing models define translationModel() and $translatable.
 */
trait HasTranslations
{
    /** @var array<int,string> translatable attribute names */
    // protected array $translatable = ['name', 'description'];

    abstract public function translationModel(): string;

    public function translations(): HasMany
    {
        return $this->hasMany($this->translationModel());
    }

    /** Resolve one translatable field for a locale, falling back gracefully. */
    public function translate(string $field, ?string $locale = null): mixed
    {
        $locale ??= app()->getLocale();

        $match = $this->translations
            ->firstWhere('locale', $locale)
            ?? $this->translations->firstWhere('locale', config('app.fallback_locale'));

        $value = $match?->{$field};

        return ($value !== null && $value !== '') ? $value : $this->getAttribute($field);
    }

    /** @return array<string,string> translatable fields resolved for a locale */
    public function translatedAttributes(?string $locale = null): array
    {
        $out = [];
        foreach ($this->translatable ?? [] as $field) {
            $out[$field] = $this->translate($field, $locale);
        }

        return $out;
    }
}
