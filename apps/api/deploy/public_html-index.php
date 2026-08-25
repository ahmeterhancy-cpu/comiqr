<?php

/**
 * public_html/index.php — paylaşımlı barındırma (cPanel) girişi.
 *
 * Laravel'in kendi `public/index.php`'si uygulamayı bir üst klasörde arar.
 * Paylaşımlı pakette web kökü `public_html`, uygulama ise ev dizininde
 * (`~/comiqr`) durduğu için yollar buradan verilir. Kod web kökünün DIŞINDA
 * kalmalı: aksi hâlde `.env`, `storage/` ve `vendor/` tarayıcıdan indirilebilir.
 *
 * `$app` yolu ortamdan da okunabilir; cPanel kullanıcı adı sabitlenmesin diye
 * varsayılan, bu dosyanın bulunduğu yere göre hesaplanır.
 */

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

/** Uygulama kökü: ev dizinindeki `comiqr` klasörü. */
$app_root = dirname(__DIR__).'/comiqr';

if (file_exists($maintenance = $app_root.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $app_root.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once $app_root.'/bootstrap/app.php';

$app->handleRequest(Request::capture());
