<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product */
class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $locale = $request->query('locale', app()->getLocale());
        $translated = $this->relationLoaded('translations');

        $summary = $this->whenLoaded('nutritionSummary');
        $showNutrition = $this->calories_display && $summary && ! ($summary->is_stale ?? true);

        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'name' => $translated ? $this->translate('name', $locale) : $this->name,
            'description' => $translated ? $this->translate('description', $locale) : $this->description,
            'price' => $this->price,
            'images' => $this->image_paths_json ?? [],
            'video' => $this->video_path,
            'is_active' => $this->is_active,
            'age_restricted' => (bool) $this->age_restricted,
            'sort' => $this->sort,
            'prep_minutes' => $this->prep_minutes,
            'tags' => $this->tags_json ?? [],
            'calories_display' => $this->calories_display,
            'variants' => VariantResource::collection($this->whenLoaded('variants')),
            'modifier_groups' => ModifierGroupResource::collection($this->whenLoaded('modifierGroups')),
            'nutrition' => $showNutrition ? new NutritionSummaryResource($summary) : null,
        ];
    }
}
