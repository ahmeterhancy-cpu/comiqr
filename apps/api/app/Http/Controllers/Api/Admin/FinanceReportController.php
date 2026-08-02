<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\FinanceReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Maliyet-kâr raporu (Faz 4). Tenant-scoped, manager+, plan-gated.
 */
class FinanceReportController extends Controller
{
    public function __construct(protected FinanceReport $report) {}

    /** GET /admin/reports/profit-loss */
    public function profitLoss(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);

        return response()->json([
            'data' => $this->report->profitLoss($from, $to, $request->integer('branch_id') ?: null),
        ]);
    }

    /** GET /admin/reports/accounts — alacak/borç özeti. */
    public function accounts(): JsonResponse
    {
        return response()->json(['data' => $this->report->accountsSummary()]);
    }

    /** GET /admin/reports/profit-loss.csv — muhasebeciye gönderilecek günlük döküm. */
    public function profitLossCsv(Request $request): StreamedResponse
    {
        [$from, $to] = $this->range($request);
        $data = $this->report->profitLoss($from, $to, $request->integer('branch_id') ?: null);
        $filename = "kar-zarar-{$data['range']['from']}_{$data['range']['to']}.csv";

        return response()->streamDownload(function () use ($data) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM — Excel'in Türkçe karakterleri bozmaması için
            fputcsv($out, ['Tarih', 'Net Satış', 'Maliyet (COGS)', 'Gider', 'Kâr']);

            foreach ($data['daily'] as $day) {
                fputcsv($out, [$day['date'], $day['net_sales'], $day['cogs'], $day['expenses'], $day['profit']]);
            }

            fputcsv($out, []);
            fputcsv($out, ['TOPLAM', $data['sales']['net_sales'], $data['cogs']['cogs'], $data['expenses']['total'], $data['net_profit']]);
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** @return array{0:Carbon,1:Carbon} */
    private function range(Request $request): array
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'branch_id' => ['nullable', 'integer'],
        ]);

        $to = ($request->date('to') ?? now())->endOfDay();
        $from = ($request->date('from') ?? now()->copy()->startOfMonth())->startOfDay();

        return [$from, $to];
    }
}
