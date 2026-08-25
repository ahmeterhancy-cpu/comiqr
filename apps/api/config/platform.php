<?php

/**
 * Platform (kiracısız) ayarları.
 *
 * `env()` YALNIZCA config dosyalarında çağrılmalı: `config:cache` çalıştıktan
 * sonra Laravel `.env`'i hiç yüklemez ve başka yerdeki `env()` null döner.
 * Seeder bu yüzden değerleri buradan okur — aksi hâlde sunucuda süperadmin
 * parolası sessizce varsayılana düşüyordu.
 */
return [

    'superadmin' => [
        'email' => env('SUPERADMIN_EMAIL', 'superadmin@comiqr.com'),

        /*
         * Üretimde parola VERİLMEK ZORUNDA. Zayıf bir varsayılana düşmek
         * yerine seeder hata verir; sessizce 'password' ile açılmış bir
         * platform yöneticisi, fark edilmesi en zor açıklardan biri.
         */
        'password' => env('SUPERADMIN_PASSWORD'),
    ],

];
