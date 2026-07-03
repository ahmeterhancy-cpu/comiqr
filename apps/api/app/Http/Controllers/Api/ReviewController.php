<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesQrToken;
use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Models\Order;
use App\Models\Review;
use App\Models\Tenant;
use App\Services\LoyaltyService;
use App\Services\ReviewService;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Customer reviews + venue reputation (Faz 3). Customers rate an order via the
 * table token; owners list/reply/moderate; discovery + menu read the score.
 */
class ReviewController extends Controller
{
    use ResolvesQrToken;

    public function __construct(
        protected ReviewService $reviews,
        protected LoyaltyService $loyalty,
        protected TenantManager $tenants,
    ) {}

    /** POST /sessions/{qrToken}/orders/{order}/review — one review per order. */
    public function store(Request $request, string $qrToken, string $order): JsonResponse
    {
        [$table] = $this->resolveByToken($qrToken);

        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:1000'],
            'customer' => ['nullable', 'array'],
            'customer.phone' => ['nullable', 'string', 'max:32'],
            'customer.name' => ['nullable', 'string', 'max:120'],
        ]);

        $model = Order::with(['tableSession', 'review'])->find($order);
        abort_if($model === null || $model->tableSession?->table_id !== $table->id, 404, 'Order not found.');
        abort_if($model->review !== null, 422, 'Bu sipariş zaten değerlendirildi.');

        $customer = $model->customer ?: $this->loyalty->identify($request->input('customer', []));

        try {
            $review = $this->reviews->submit($model, $data['rating'], $data['comment'] ?? null, $customer);
        } catch (\Illuminate\Database\UniqueConstraintViolationException) {
            // Lost a race with a concurrent submit — still one review per order.
            abort(422, 'Bu sipariş zaten değerlendirildi.');
        }

        return response()->json(['data' => new ReviewResource($review)], 201);
    }

    /** GET /admin/reviews — tenant reviews + reputation summary (manager+). */
    public function index(): JsonResponse
    {
        $reviews = Review::query()->latest()->limit(200)->get();

        return response()->json(['data' => [
            'reviews' => ReviewResource::collection($reviews)->resolve(),
            'reputation' => $this->reviews->reputation($this->tenants->id()),
        ]]);
    }

    /** POST /admin/reviews/{review}/reply — owner response. */
    public function reply(Request $request, string $review): JsonResponse
    {
        $data = $request->validate(['reply' => ['nullable', 'string', 'max:1000']]);
        $model = Review::findOrFail($review);
        $model->update(['reply' => $data['reply'] ?: null]);

        return response()->json(['data' => new ReviewResource($model->fresh())]);
    }

    /** POST /admin/reviews/{review}/status — publish / hide (moderation). */
    public function setStatus(Request $request, string $review): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['published', 'hidden'])]]);
        $model = Review::findOrFail($review);
        $model->update(['status' => $data['status']]);

        return response()->json(['data' => new ReviewResource($model->fresh())]);
    }

    /** GET /venues/{slug}/reviews — public recent published reviews for a venue. */
    public function venueReviews(string $slug): JsonResponse
    {
        $tenant = Tenant::where('slug', $slug)->first();
        abort_if($tenant === null || $tenant->status === 'suspended', 404, 'Venue not found.');

        $reviews = Review::withoutTenancy()
            ->where('tenant_id', $tenant->id)
            ->where('status', 'published')
            ->latest()
            ->limit(30)
            ->get();

        return response()->json(['data' => [
            'reviews' => $reviews->map(fn (Review $r) => [
                'rating' => $r->rating,
                'comment' => $r->comment,
                'reply' => $r->reply,
                'created_at' => $r->created_at,
            ])->values(),
            'reputation' => $this->reviews->reputation($tenant->id),
        ]]);
    }
}
