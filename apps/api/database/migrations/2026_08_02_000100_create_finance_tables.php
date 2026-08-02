<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance module (Faz 4 — gider · cari · maliyet-kâr). Tenant-scoped.
 *
 * Balance convention, used everywhere in this module: `balance` is signed from
 * OUR point of view — positive means the counterparty owes us (a receivable:
 * veresiye satış), negative means we owe them (a payable: vadeli alım). Every
 * ledger row stores the signed delta it applied, so the cached balance is always
 * opening_balance + SUM(account_transactions.amount) and can be re-derived.
 */
return new class extends Migration
{
    public function up(): void
    {
        // --- Expense categories (Kira, Personel, Enerji, Tedarik, ...) ---------
        Schema::create('expense_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('name');
            $table->string('color', 9)->nullable();  // panel rozeti (#RRGGBB)
            $table->boolean('is_fixed')->default(false); // sabit gider (kira) vs değişken
            $table->unsignedSmallInteger('sort')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'name']);
        });

        // --- Current accounts / cari hesaplar (tedarikçi · müşteri · personel) --
        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('type', 16)->default('supplier'); // supplier|customer|staff|other
            $table->string('name');
            $table->string('phone', 32)->nullable();
            $table->string('email')->nullable();
            $table->string('tax_no', 32)->nullable();
            $table->text('address')->nullable();
            $table->text('note')->nullable();
            // Veresiye tavanı — 0 = limitsiz. Only meaningful for receivables.
            $table->decimal('credit_limit', 12, 2)->default(0);
            $table->decimal('opening_balance', 12, 2)->default(0);
            // Cached signed balance (see convention above); kept in step with the ledger.
            $table->decimal('balance', 12, 2)->default(0);
            // Optional link to the CRM customer card, so a veresiye guest is one person.
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'type']);
            $table->index(['tenant_id', 'customer_id']);
        });

        // --- Expenses / giderler ------------------------------------------------
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('expense_category_id')->nullable()->constrained('expense_categories')->nullOnDelete();
            // Tedarikçi carisi — 'credit' ödemede bu cariye borç yazılır.
            $table->foreignId('account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->string('description');
            $table->decimal('amount', 12, 2)->default(0);      // KDV hariç tutar
            $table->decimal('tax_amount', 12, 2)->default(0);  // KDV
            $table->string('payment_method', 16)->default('cash'); // cash|card|transfer|credit
            $table->date('spent_on');
            $table->string('document_no', 64)->nullable();     // fiş/fatura no
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'spent_on']);
            $table->index(['tenant_id', 'expense_category_id']);
            $table->index(['tenant_id', 'account_id']);
        });

        // --- Account ledger / cari hareketler -----------------------------------
        Schema::create('account_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('account_id')->constrained('accounts')->cascadeOnDelete();
            // charge   : veresiye satış      → +  (bize borçlandı)
            // collect  : tahsilat            → -  (borcunu ödedi)
            // purchase : vadeli alım/gider   → -  (biz borçlandık)
            // settle   : tedarikçiye ödeme   → +  (borcumuzu kapattık)
            // opening / adjustment           → serbest işaret
            $table->string('type', 16);
            // Signed delta applied to the balance (see convention above).
            $table->decimal('amount', 12, 2);
            $table->string('method', 16)->nullable(); // cash|card|transfer
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->foreignId('expense_id')->nullable()->constrained('expenses')->nullOnDelete();
            $table->date('occurred_on');
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'account_id', 'occurred_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_transactions');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('accounts');
        Schema::dropIfExists('expense_categories');
    }
};
