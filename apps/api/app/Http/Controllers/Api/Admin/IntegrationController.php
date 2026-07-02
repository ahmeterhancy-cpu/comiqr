<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Integration;
use App\Services\IntegrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * External integration management (Faz 2, docs/01 §1.4) — manager+. POS/ÖKC/ERP/
 * delivery connectors. Secrets are write-only (never returned); the endpoint is
 * shown so the venue can confirm where data flows.
 */
class IntegrationController extends Controller
{
    public function __construct(private IntegrationService $integrations) {}

    public function index(): JsonResponse
    {
        $items = Integration::orderBy('type')->get()->map($this->present(...));

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        $integration = Integration::create($data);

        return response()->json(['data' => $this->present($integration)], 201);
    }

    public function update(Request $request, string $integration): JsonResponse
    {
        $model = Integration::findOrFail($integration);
        $model->update($this->validateData($request, partial: true));

        return response()->json(['data' => $this->present($model)]);
    }

    public function destroy(string $integration): JsonResponse
    {
        Integration::findOrFail($integration)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    /** POST /admin/integrations/{integration}/test — send a connectivity ping. */
    public function test(string $integration): JsonResponse
    {
        $model = Integration::findOrFail($integration);
        $ok = $this->integrations->ping($model);

        return response()->json(['data' => ['ok' => $ok]], $ok ? 200 : 422);
    }

    /** @return array<string,mixed> */
    private function validateData(Request $request, bool $partial = false): array
    {
        $req = fn (string ...$rules) => $partial ? array_merge(['sometimes'], $rules) : array_merge(['required'], $rules);

        return $request->validate([
            'type' => [...$req(), Rule::in(Integration::TYPES)],
            'provider' => $req('string', 'max:40'),
            'name' => $req('string', 'max:120'),
            'config_json' => ['nullable', 'array'],
            'config_json.endpoint' => ['nullable', 'url', 'max:2048'],
            'config_json.secret' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);
    }

    /** @return array<string,mixed> */
    private function present(Integration $integration): array
    {
        $config = $integration->config_json ?? [];

        return [
            'id' => $integration->id,
            'type' => $integration->type,
            'provider' => $integration->provider,
            'name' => $integration->name,
            'endpoint' => $config['endpoint'] ?? null,
            'has_secret' => ! empty($config['secret']),
            'is_active' => $integration->is_active,
            'last_synced_at' => $integration->last_synced_at,
        ];
    }
}
