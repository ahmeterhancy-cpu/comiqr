<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Campaign;
use App\Services\CampaignService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Campaign management (Faz 2, M8, docs/06 §6.9) — manager+. Drafts are created
 * then sent; delivery is handled by CampaignService over the abstract channel.
 */
class CampaignController extends Controller
{
    public function __construct(private CampaignService $campaigns) {}

    public function index(): JsonResponse
    {
        $campaigns = Campaign::query()->latest()->limit(100)->get()->map($this->present(...));

        return response()->json(['data' => $campaigns]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'channel' => ['required', Rule::in(Campaign::CHANNELS)],
            'subject' => ['nullable', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:2000'],
            'audience' => ['required', Rule::in(Campaign::AUDIENCES)],
            'min_points' => ['nullable', 'required_if:audience,min_points', 'integer', 'min:0'],
        ]);

        $campaign = Campaign::create([
            ...$data,
            'status' => 'draft',
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $this->present($campaign)], 201);
    }

    public function destroy(string $campaign): JsonResponse
    {
        Campaign::findOrFail($campaign)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    /** POST /admin/campaigns/{campaign}/send — deliver to the resolved audience. */
    public function send(string $campaign): JsonResponse
    {
        $model = Campaign::findOrFail($campaign);
        $model = $this->campaigns->send($model);

        return response()->json(['data' => $this->present($model)]);
    }

    /** @return array<string,mixed> */
    private function present(Campaign $campaign): array
    {
        return [
            'id' => $campaign->id,
            'name' => $campaign->name,
            'channel' => $campaign->channel,
            'subject' => $campaign->subject,
            'body' => $campaign->body,
            'audience' => $campaign->audience,
            'min_points' => $campaign->min_points,
            'status' => $campaign->status,
            'recipient_count' => $campaign->recipient_count,
            'sent_count' => $campaign->sent_count,
            'sent_at' => $campaign->sent_at,
            'created_at' => $campaign->created_at,
        ];
    }
}
