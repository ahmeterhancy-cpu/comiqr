<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Restaurant logo / cover image upload (Faz 2, M20). Stored on the public disk
 * (R2 in prod), served via GET /v1/media/{path}; the URL is saved into
 * tenants.settings_json.logo / .cover.
 */
class RestaurantMediaController extends Controller
{
    public function __construct(protected TenantManager $tenants) {}

    public function upload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'in:logo,cover'],
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        abort_unless($this->tenants->check(), 403, 'No active tenant.');
        $tenant = $this->tenants->get();

        $path = 'restaurants/'.$tenant->id.'/'.$data['type'].'-'.Str::uuid().'.'.$request->file('image')->extension();
        Storage::disk('public')->put($path, $request->file('image')->getContent());

        $url = url('/v1/media/'.$path);
        $settings = $tenant->settings_json ?? [];
        $settings[$data['type']] = $url;
        $tenant->update(['settings_json' => $settings]);

        return response()->json(['data' => ['type' => $data['type'], 'url' => $url]], 201);
    }
}
