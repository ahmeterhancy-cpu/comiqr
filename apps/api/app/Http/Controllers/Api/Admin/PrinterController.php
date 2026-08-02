<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Printer;
use App\Models\PrintJob;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Printer routing (Faz 4). Manager-only CRUD plus the queue the local bridge
 * works from. Putting ink on paper happens on the venue's own network — this
 * API decides WHAT prints WHERE and holds the jobs until a bridge collects them.
 */
class PrinterController extends Controller
{
    public function index(): JsonResponse
    {
        $printers = Printer::withCount(['jobs as pending_jobs_count' => fn ($q) => $q->where('status', 'pending')])
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $printers]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => Printer::create($this->validateData($request))], 201);
    }

    public function update(Request $request, string $printer): JsonResponse
    {
        $model = Printer::findOrFail($printer);
        $model->update($this->validateData($request, $model->id));

        return response()->json(['data' => $model->fresh()]);
    }

    public function destroy(string $printer): JsonResponse
    {
        Printer::findOrFail($printer)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    /** POST /admin/printers/{printer}/test — queue a test slip for this printer. */
    public function test(string $printer): JsonResponse
    {
        $model = Printer::findOrFail($printer);

        $job = PrintJob::create([
            'printer_id' => $model->id,
            'type' => 'test',
            'payload_json' => [
                'type' => 'test',
                'printer' => ['id' => $model->id, 'name' => $model->name, 'kind' => $model->kind],
                'lines' => [['name' => 'ComiQR test fişi', 'quantity' => 1, 'modifiers' => []]],
                'copies' => 1,
            ],
            'status' => 'pending',
        ]);

        return response()->json(['data' => $job], 201);
    }

    /** GET /admin/print-jobs — the queue, newest first (panel view). */
    public function jobs(Request $request): JsonResponse
    {
        $jobs = PrintJob::with('printer:id,name,kind')
            ->when($request->integer('printer_id'), fn ($q, $id) => $q->where('printer_id', $id))
            ->when($request->string('status')->toString(), fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('id')
            ->paginate(min(100, max(10, $request->integer('per_page') ?: 30)));

        return response()->json([
            'data' => $jobs,
            'meta' => ['pending' => PrintJob::where('status', 'pending')->count()],
        ]);
    }

    /**
     * GET /admin/print-jobs/pending?printer_id= — what the local bridge polls.
     * Oldest first: a kitchen ticket must not overtake the one before it.
     */
    public function pending(Request $request): JsonResponse
    {
        $request->validate(['printer_id' => ['nullable', 'integer']]);

        $jobs = PrintJob::where('status', 'pending')
            ->when($request->integer('printer_id'), fn ($q, $id) => $q->where('printer_id', $id))
            ->with('printer:id,name,kind,target,copies')
            ->orderBy('id')
            ->limit(20)
            ->get();

        return response()->json(['data' => $jobs]);
    }

    /** POST /admin/print-jobs/{job}/ack — the bridge reports the outcome. */
    public function ack(Request $request, string $job): JsonResponse
    {
        $data = $request->validate([
            'ok' => ['required', 'boolean'],
            'error' => ['nullable', 'string', 'max:500'],
        ]);

        $model = PrintJob::findOrFail($job);
        $model->update([
            'status' => $data['ok'] ? 'printed' : 'failed',
            'attempts' => (int) $model->attempts + 1,
            'error' => $data['ok'] ? null : ($data['error'] ?? 'unknown'),
            'printed_at' => $data['ok'] ? now() : null,
        ]);

        return response()->json(['data' => $model->fresh()]);
    }

    /** POST /admin/print-jobs/{job}/retry — put a failed slip back in the queue. */
    public function retry(string $job): JsonResponse
    {
        $model = PrintJob::findOrFail($job);
        $model->update(['status' => 'pending', 'error' => null]);

        return response()->json(['data' => $model->fresh()]);
    }

    private function validateData(Request $request, ?int $id = null): array
    {
        $tenantId = app(TenantManager::class)->id();
        $required = $id ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:80'],
            'kind' => [$required, Rule::in(Printer::KINDS)],
            'branch_id' => [
                'nullable',
                Rule::exists('branches', 'id')->where('tenant_id', $tenantId)->whereNull('deleted_at'),
            ],
            'target' => ['nullable', 'string', 'max:200'],
            'category_ids_json' => ['nullable', 'array'],
            'category_ids_json.*' => [
                'integer',
                Rule::exists('categories', 'id')->where('tenant_id', $tenantId)->whereNull('deleted_at'),
            ],
            'copies' => ['nullable', 'integer', 'min:1', 'max:5'],
            'is_active' => ['boolean'],
        ]);
    }
}
