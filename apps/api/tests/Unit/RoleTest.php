<?php

use App\Enums\Role;

it('lets owner and superadmin satisfy any role', function () {
    foreach ([Role::Owner, Role::Superadmin] as $role) {
        expect($role->satisfies('manager'))->toBeTrue()
            ->and($role->satisfies('waiter'))->toBeTrue()
            ->and($role->satisfies('kitchen'))->toBeTrue();
    }
});

it('lets a manager oversee waiter and kitchen', function () {
    expect(Role::Manager->satisfies('waiter'))->toBeTrue()
        ->and(Role::Manager->satisfies('kitchen'))->toBeTrue()
        ->and(Role::Manager->satisfies('manager'))->toBeTrue();
});

it('keeps waiter and kitchen as non-overlapping siblings', function () {
    expect(Role::Waiter->satisfies('kitchen'))->toBeFalse()
        ->and(Role::Kitchen->satisfies('waiter'))->toBeFalse()
        ->and(Role::Waiter->satisfies('manager'))->toBeFalse();
});

it('matches its own role', function () {
    expect(Role::Waiter->satisfies('waiter'))->toBeTrue()
        ->and(Role::Kitchen->satisfiesAny(['manager', 'kitchen']))->toBeTrue()
        ->and(Role::Waiter->satisfiesAny(['manager', 'kitchen']))->toBeFalse();
});
