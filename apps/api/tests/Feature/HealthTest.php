<?php

use function Pest\Laravel\getJson;

it('reports readiness with DB + cache checks', function () {
    getJson('/v1/health')
        ->assertOk()
        ->assertJsonPath('status', 'ok')
        ->assertJsonPath('checks.database', 'ok')
        ->assertJsonPath('checks.cache', 'ok');
});
