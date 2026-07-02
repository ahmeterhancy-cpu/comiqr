<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;

/**
 * Customer/CRM list (Faz 2, M8, docs/06 §6.9). PII is masked in the panel (KVKK).
 */
class CustomerController extends Controller
{
    public function index(): JsonResponse
    {
        $customers = Customer::query()
            ->with('loyaltyAccount')
            ->orderByDesc('total_spend')
            ->limit(200)
            ->get()
            ->map(fn (Customer $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'phone_masked' => $c->maskedPhone(),
                'total_orders' => $c->total_orders,
                'total_spend' => $c->total_spend,
                'points' => $c->loyaltyAccount?->points_balance ?? 0,
                'tier' => $c->loyaltyAccount?->tier ?? 'standard',
                'last_seen_at' => $c->last_seen_at,
            ]);

        return response()->json(['data' => $customers]);
    }
}
