<?php

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
| Feature tests get a fresh migrated PostgreSQL schema (RefreshDatabase) so
| tenant-isolation assertions run against real JSONB/constraints. Unit tests
| stay database-free for speed.
*/

pest()->extend(Tests\TestCase::class)
    ->use(Illuminate\Foundation\Testing\RefreshDatabase::class)
    ->in('Feature');

pest()->extend(Tests\TestCase::class)
    ->in('Unit');

/*
|--------------------------------------------------------------------------
| Expectations & Helpers
|--------------------------------------------------------------------------
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});
