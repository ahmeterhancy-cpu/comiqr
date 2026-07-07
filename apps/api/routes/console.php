<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Housekeeping (B1) — keeps operational tables from growing unbounded. Requires a
 * `* * * * * php artisan schedule:run` cron in production.
 */
Schedule::command('sanctum:prune-expired --hours=24')->daily();   // stale personal access tokens
Schedule::command('queue:prune-failed --hours=168')->daily();     // failed jobs older than 7 days
Schedule::command('model:prune')->daily();                        // any Prunable models
