<?php

namespace App\Http\Resources;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Category */
class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $locale = $request->query('locale', app()->getLocale());

        return [
            'id' => $this->id,
            'parent_id' => $this->parent_id,
            'branch_id' => $this->branch_id,
            'name' => $this->relationLoaded('translations') ? $this->translate('name', $locale) : $this->name,
            'sort' => $this->sort,
            'is_active' => $this->is_active,
            'image_path' => $this->image_path,
            'products' => ProductResource::collection($this->whenLoaded('products')),
        ];
    }
}
