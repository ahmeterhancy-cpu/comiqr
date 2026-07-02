<?php

namespace App\Http\Controllers\Api;

use App\Events\ItemEightySixed;
use App\Events\OrderItemStatusChanged;
use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\EightySixItem;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Kitchen Display System (M6, docs/06 §6.7). Kitchen/manager only. Item status
 * transitions and 86 changes broadcast over Reverb (KDS/waiter/customer).
 */
class KdsController extends Controller
{
    private const FLOW = ['pending', 'preparing', 'ready', 'served'];

    /** GET /kds/{branch}/orders?station= — active tickets for a branch. */
    public function orders(Request $request, string $branch): JsonResponse
    {
        $branchId = $this->branchId($branch);
        $stationCategoryIds = $this->stationCategories($request);

        $orders = Order::query()
            ->where('branch_id', $branchId)
            ->whereIn('status', ['pending', 'preparing', 'ready'])
            ->with(['items' => function ($q) use ($stationCategoryIds) {
                $q->whereIn('status', ['pending', 'preparing', 'ready'])->with('product:id,name,category_id');
                if ($stationCategoryIds !== null) {
                    $q->whereHas('product', fn ($p) => $p->whereIn('category_id', $stationCategoryIds));
                }
            }])
            ->orderBy('placed_at')
            ->get()
            ->filter(fn (Order $o) => $o->items->isNotEmpty())
            ->map(fn (Order $o) => [
                'order_id' => $o->id,
                'table_session_id' => $o->table_session_id,
                'status' => $o->status,
                'placed_at' => $o->placed_at,
                'items' => $o->items->map(fn (OrderItem $i) => [
                    'id' => $i->id,
                    'product' => $i->product?->name,
                    'quantity' => $i->quantity,
                    'status' => $i->status,
                    'note' => $i->note,
                    'modifiers' => $i->modifiers_json ?? [],
                ])->values(),
            ])->values();

        return response()->json(['data' => $orders]);
    }

    /** POST /kds/order-items/{item}/status — advance an item's status. */
    public function status(Request $request, string $item): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['preparing', 'ready', 'served', 'cancelled'])],
        ]);

        $orderItem = $this->findItem($item);
        $orderItem->update(['status' => $data['status']]);

        return $this->afterItemChange($orderItem);
    }

    /** POST /kds/order-items/{item}/bump — mark ready→served (off the board). */
    public function bump(string $item): JsonResponse
    {
        $orderItem = $this->findItem($item);
        $orderItem->update(['status' => 'served']);

        return $this->afterItemChange($orderItem);
    }

    /** POST /kds/eighty-six — mark a product out of stock for a branch. */
    public function eightySix(Request $request): JsonResponse
    {
        $data = $request->validate([
            'branch_id' => ['required', Rule::exists('branches', 'id')],
            'product_id' => ['required', Rule::exists('products', 'id')],
            'reason' => ['nullable', 'string', 'max:255'],
            'until' => ['nullable', 'date'],
        ]);

        $eightySix = EightySixItem::updateOrCreate(
            ['branch_id' => $data['branch_id'], 'product_id' => $data['product_id']],
            ['reason' => $data['reason'] ?? null, 'until' => $data['until'] ?? null, 'created_by' => $request->user()->id],
        );

        ItemEightySixed::dispatch((int) $data['branch_id'], (int) $data['product_id'], false);

        return response()->json(['data' => ['id' => $eightySix->id, 'product_id' => $eightySix->product_id]], 201);
    }

    /** DELETE /kds/eighty-six/{id} — restore a product to the menu. */
    public function removeEightySix(string $id): JsonResponse
    {
        $eightySix = EightySixItem::findOrFail($id);
        $branchId = $eightySix->branch_id;
        $productId = $eightySix->product_id;
        $eightySix->delete();

        ItemEightySixed::dispatch($branchId, $productId, true);

        return response()->json(['data' => ['restored' => true]]);
    }

    private function afterItemChange(OrderItem $orderItem): JsonResponse
    {
        $order = $orderItem->order;
        $order->refreshStatusFromItems();

        OrderItemStatusChanged::dispatch($orderItem, $order->branch_id, $order->table_session_id);

        return response()->json(['data' => [
            'order_item_id' => $orderItem->id,
            'status' => $orderItem->status,
            'order_status' => $order->fresh()->status,
        ]]);
    }

    private function findItem(string $id): OrderItem
    {
        // Scope the item to the active tenant via its order (tenant-owned).
        $item = OrderItem::whereHas('order')->with('order')->find($id);
        abort_if($item === null, 404, 'Order item not found.');

        return $item;
    }

    private function branchId(string $branch): int
    {
        $model = Branch::find($branch);
        abort_if($model === null, 404, 'Branch not found.');

        return $model->id;
    }

    private function stationCategories(Request $request): ?array
    {
        if (! $request->filled('station')) {
            return null;
        }

        $station = \App\Models\KdsStation::find($request->integer('station'));
        if ($station === null) {
            throw ValidationException::withMessages(['station' => ['Unknown station.']]);
        }

        return $station->category_ids_json ?: [];
    }
}
