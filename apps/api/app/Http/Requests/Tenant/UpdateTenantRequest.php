<?php

namespace App\Http\Requests\Tenant;

use App\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTenantRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && $user->role?->satisfiesAny([Role::Manager->value]);
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'min:2', 'max:255'],
            'locale_default' => ['sometimes', 'string', Rule::in(['tr', 'en', 'de', 'ru', 'ar'])],
            'currency' => ['sometimes', 'string', 'size:3'],
            'timezone' => ['sometimes', 'timezone'],
            'settings_json' => ['sometimes', 'array'],
            'settings_json.branding' => ['sometimes', 'array'],
        ];
    }
}
