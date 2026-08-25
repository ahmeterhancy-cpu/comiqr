<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Platform-level (tenant-less) settings — anahtar/değer.
 *
 * İlk kullanıcısı landing sayfası: metin artık yalnız çeviri dosyalarında
 * sabit değil, süperadmin panelden düzenlenebiliyor. Burada saklanan şey tam
 * içerik DEĞİL, yalnızca **üzerine yazılan alanlar**: dosyadaki çeviri
 * varsayılan olarak kalır, kayıt yoksa sayfa bugünkü hâliyle yayınlanır ve bir
 * alan silindiğinde varsayılana geri döner. Böylece yeni bir dil ya da yeni bir
 * bölüm eklendiğinde panelde karşılığı olmasa bile sayfa eksik kalmaz.
 *
 * Kiracıya bağlı olmadığı için `tenant_id` yok; yazma yetkisi superadmin
 * middleware'inde.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_settings', function (Blueprint $table) {
            $table->id();
            // landing.content.tr · landing.content.en · landing.media
            $table->string('key')->unique();
            $table->json('value_json')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_settings');
    }
};
