<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Product image upload (M1, docs/06 §6.5). Stored on the public disk in dev and
 * on R2 in production; served via GET /v1/media/{path}.
 */
class ProductMediaController extends Controller
{
    public function upload(Request $request, string $product): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $model = Product::findOrFail($product);

        $path = 'products/'.$model->tenant_id.'/'.Str::uuid().'.'.$request->file('image')->extension();
        Storage::disk('public')->put($path, $request->file('image')->getContent());

        $url = url('/v1/media/'.$path);
        $images = $model->image_paths_json ?? [];
        $images[] = $url;
        $model->update(['image_paths_json' => $images]);

        return response()->json(['data' => new ProductResource($model->fresh())], 201);
    }

    public function destroy(string $product, Request $request): JsonResponse
    {
        $model = Product::findOrFail($product);
        $url = $request->validate(['url' => ['required', 'string']])['url'];

        $images = array_values(array_filter($model->image_paths_json ?? [], fn ($u) => $u !== $url));
        $model->update(['image_paths_json' => $images]);

        // Best-effort delete of the stored file.
        $path = Str::after($url, '/v1/media/');
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }

        return response()->json(['data' => new ProductResource($model->fresh())]);
    }
}
