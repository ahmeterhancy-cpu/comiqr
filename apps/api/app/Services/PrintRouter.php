<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Printer;
use App\Models\PrintJob;
use Illuminate\Support\Collection;

/**
 * Sends each part of an order to the station that makes it (Faz 4 — roadmap
 * madde 4). Hot food goes to the kitchen printer, drinks to the bar, and a venue
 * with one printer gets the whole ticket on it.
 *
 * Routing is by the product's menu category. A printer with no category list is
 * a catch-all; a line whose category matches nothing still prints, on the
 * branch's catch-all printers, because a ticket that silently vanishes is worse
 * than one printed at the wrong station.
 *
 * Failures never break order placement: a venue with no printers configured, or
 * a routing error, must not stop a guest from ordering.
 */
class PrintRouter
{
    /** Ticket for a brand-new order. */
    public function routeOrder(Order $order): Collection
    {
        return $this->route($order, $order->items()->where('status', '!=', 'cancelled')->get(), 'order');
    }

    /** Ticket for lines added to an open tab — the kitchen only wants the new ones. */
    public function routeAddition(Order $order, Collection $lines): Collection
    {
        return $this->route($order, $lines, 'addition');
    }

    /**
     * @param  Collection<int,OrderItem>  $lines
     * @return Collection<int,PrintJob>
     */
    protected function route(Order $order, Collection $lines, string $type): Collection
    {
        $jobs = collect();

        if ($lines->isEmpty()) {
            return $jobs;
        }

        $printers = Printer::where('is_active', true)
            ->where(fn ($q) => $q->whereNull('branch_id')->orWhere('branch_id', $order->branch_id))
            ->get();

        if ($printers->isEmpty()) {
            return $jobs;
        }

        $lines->loadMissing('product:id,name,category_id');

        // Printers that name their categories are stations; the rest are catch-alls.
        // A catch-all takes only what no station claimed — otherwise the kitchen
        // ticket would also spool at the till — but it does take the leftovers, so
        // a line is never silently dropped.
        $stations = $printers->filter(fn (Printer $p) => is_array($p->category_ids_json) && $p->category_ids_json !== []);

        foreach ($printers as $printer) {
            $isStation = $stations->contains(fn (Printer $p) => $p->id === $printer->id);

            $mine = $lines->filter(function (OrderItem $line) use ($printer, $stations, $isStation) {
                $categoryId = $line->product?->category_id;

                return $isStation
                    ? $printer->handlesCategory($categoryId)
                    : ! $stations->contains(fn (Printer $p) => $p->handlesCategory($categoryId));
            })->values();

            if ($mine->isEmpty()) {
                continue;
            }

            $jobs->push(PrintJob::create([
                'printer_id' => $printer->id,
                'order_id' => $order->id,
                'type' => $type,
                'payload_json' => $this->payload($order, $mine, $printer, $type),
                'status' => 'pending',
            ]));
        }

        return $jobs;
    }

    /**
     * The ticket as data. Deliberately not ESC-POS: the bridge renders it for its
     * own paper width, and the panel can preview the same job on screen.
     *
     * @param  Collection<int,OrderItem>  $lines
     * @return array<string,mixed>
     */
    protected function payload(Order $order, Collection $lines, Printer $printer, string $type): array
    {
        return [
            'type' => $type,
            'printer' => ['id' => $printer->id, 'name' => $printer->name, 'kind' => $printer->kind],
            'order' => [
                'id' => $order->id,
                'source' => $order->source,
                'table' => $order->tableSession?->table?->code,
                'placed_at' => $order->placed_at?->toIso8601String(),
                'note' => $order->note,
            ],
            'lines' => $lines->map(fn (OrderItem $line) => [
                'name' => $line->product?->name,
                'quantity' => (int) $line->quantity,
                'note' => $line->note,
                'modifiers' => collect($line->modifiers_json ?? [])->pluck('name')->all(),
            ])->all(),
            'copies' => (int) $printer->copies,
        ];
    }
}
