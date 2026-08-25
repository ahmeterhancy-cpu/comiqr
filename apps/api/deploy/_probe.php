<?php

/**
 * GECICI teshis dosyasi — isi bitince silinecek.
 *
 * Tek sorusu var: PHP, web kokunun DISINDAKI uygulama klasorunu okuyabiliyor mu?
 * Paylasimli barindirmada `open_basedir` bunu engelleyebilir; engelliyorsa
 * uygulama public_html icine tasinmali (ve .env bir .htaccess ile kapatilmali).
 *
 * Hicbir gizli deger basmaz; yalnizca yol ve evet/hayir bilgisi verir.
 */

header('Content-Type: text/plain; charset=utf-8');

$appRoot = dirname(__DIR__).'/comiqr';
$autoload = $appRoot.'/vendor/autoload.php';
$env = $appRoot.'/.env';

$basedir = ini_get('open_basedir');

echo "PHP surumu      : ".PHP_VERSION."\n";
echo "web koku        : ".__DIR__."\n";
echo "aranan uygulama : ".$appRoot."\n";
echo "open_basedir    : ".($basedir === '' || $basedir === false ? '(kisitsiz)' : $basedir)."\n";
echo "\n";
echo "uygulama klasoru okunabiliyor mu : ".(is_dir($appRoot) ? 'EVET' : 'HAYIR')."\n";
echo "vendor/autoload.php var mi       : ".(is_file($autoload) ? 'EVET' : 'HAYIR')."\n";
echo "  .env var mi                    : ".(is_file($env) ? 'EVET' : 'HAYIR')."\n";
echo "\n";

if (is_dir($appRoot)) {
    echo "SONUC: web koku disindaki uygulama OKUNABILIYOR. Mevcut yerlesim calisir.\n";
} else {
    echo "SONUC: web koku disi OKUNAMIYOR. Uygulama public_html icine tasinmali.\n";
}
