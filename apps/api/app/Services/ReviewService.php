<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Review;

/**
 * Customer reviews + venue reputation (Faz 3). One review per order; only
 * `published` reviews count toward the reputation shown on discovery + menu.
 */
class ReviewService
{
    /** Loyalty points granted for leaving a review. */
    public const REVIEW_POINTS = 20;

    public function __construct(protected LoyaltyService $loyalty) {}

    /** Record a review for an order and award the loyalty bonus (if identified). */
    public function submit(Order $order, int $rating, ?string $comment, ?Customer $customer): Review
    {
        $customer ??= $order->customer;

        $review = Review::create([
            'branch_id' => $order->branch_id,
            'order_id' => $order->id,
            'customer_id' => $customer?->id,
            'rating' => max(1, min(5, $rating)),
            'comment' => $comment,
            'status' => 'published',
        ]);

        if ($customer) {
            $this->loyalty->awardReviewPoints($customer, $order->id, self::REVIEW_POINTS);
        }

        return $review;
    }

    /**
     * Reputation for one tenant: average, count and per-star distribution.
     *
     * @return array{average: float, count: int, distribution: array<int,int>}
     */
    public function reputation(int $tenantId): array
    {
        $base = Review::withoutTenancy()->where('tenant_id', $tenantId)->where('status', 'published');

        $agg = (clone $base)->selectRaw('count(*) as count, round(coalesce(avg(rating), 0)::numeric, 1) as average')->first();
        $dist = (clone $base)->selectRaw('rating, count(*) as c')->groupBy('rating')->pluck('c', 'rating');

        $distribution = [];
        foreach (range(1, 5) as $star) {
            $distribution[$star] = (int) ($dist[$star] ?? 0);
        }

        return [
            'average' => (float) ($agg->average ?? 0),
            'count' => (int) ($agg->count ?? 0),
            'distribution' => $distribution,
        ];
    }

    /**
     * Reputation for many tenants at once (discovery list).
     *
     * @param  list<int>  $tenantIds
     * @return array<int,array{average: float, count: int}>
     */
    public function reputationFor(array $tenantIds): array
    {
        if ($tenantIds === []) {
            return [];
        }

        return Review::withoutTenancy()
            ->where('status', 'published')
            ->whereIn('tenant_id', $tenantIds)
            ->selectRaw('tenant_id, round(avg(rating)::numeric, 1) as average, count(*) as count')
            ->groupBy('tenant_id')
            ->get()
            ->keyBy('tenant_id')
            ->map(fn ($r) => ['average' => (float) $r->average, 'count' => (int) $r->count])
            ->all();
    }
}
