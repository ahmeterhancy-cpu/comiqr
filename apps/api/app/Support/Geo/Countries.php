<?php

namespace App\Support\Geo;

/**
 * Country (ISO 3166-1 alpha-2) → regional defaults: currency (ISO 4217), a primary
 * IANA timezone, and one of our supported UI locales (tr/en/de/ru/ar). Used by the
 * post-signup onboarding to set up an account with the right regional settings.
 */
class Countries
{
    /** @return array{0:string,1:string,2:string} [currency, timezone, locale] */
    public static function region(string $code): array
    {
        $code = strtoupper($code);
        [$currency, $tz] = self::MAP[$code] ?? ['EUR', 'Europe/Istanbul'];

        return [$currency, $tz, self::localeFor($code)];
    }

    public static function isKnown(string $code): bool
    {
        return isset(self::MAP[strtoupper($code)]);
    }

    private static function localeFor(string $code): string
    {
        return match (true) {
            in_array($code, ['TR', 'CY', 'AZ'], true) => 'tr',
            in_array($code, ['DE', 'AT'], true) => 'de',
            in_array($code, ['RU', 'BY', 'KZ', 'KG', 'UA', 'TJ', 'TM', 'UZ'], true) => 'ru',
            in_array($code, ['SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'EG', 'IQ', 'JO', 'LB', 'LY', 'DZ', 'MA', 'TN', 'SY', 'YE', 'SD', 'PS'], true) => 'ar',
            default => 'en',
        };
    }

    /** ISO2 => [currency, primary IANA timezone]. */
    private const MAP = [
        'AD' => ['EUR', 'Europe/Andorra'], 'AE' => ['AED', 'Asia/Dubai'], 'AF' => ['AFN', 'Asia/Kabul'],
        'AG' => ['XCD', 'America/Antigua'], 'AI' => ['XCD', 'America/Anguilla'], 'AL' => ['ALL', 'Europe/Tirane'],
        'AM' => ['AMD', 'Asia/Yerevan'], 'AO' => ['AOA', 'Africa/Luanda'], 'AR' => ['ARS', 'America/Argentina/Buenos_Aires'],
        'AT' => ['EUR', 'Europe/Vienna'], 'AU' => ['AUD', 'Australia/Sydney'], 'AW' => ['AWG', 'America/Aruba'],
        'AZ' => ['AZN', 'Asia/Baku'], 'BA' => ['BAM', 'Europe/Sarajevo'], 'BB' => ['BBD', 'America/Barbados'],
        'BD' => ['BDT', 'Asia/Dhaka'], 'BE' => ['EUR', 'Europe/Brussels'], 'BF' => ['XOF', 'Africa/Ouagadougou'],
        'BG' => ['BGN', 'Europe/Sofia'], 'BH' => ['BHD', 'Asia/Bahrain'], 'BI' => ['BIF', 'Africa/Bujumbura'],
        'BJ' => ['XOF', 'Africa/Porto-Novo'], 'BM' => ['BMD', 'Atlantic/Bermuda'], 'BN' => ['BND', 'Asia/Brunei'],
        'BO' => ['BOB', 'America/La_Paz'], 'BR' => ['BRL', 'America/Sao_Paulo'], 'BS' => ['BSD', 'America/Nassau'],
        'BT' => ['BTN', 'Asia/Thimphu'], 'BW' => ['BWP', 'Africa/Gaborone'], 'BY' => ['BYN', 'Europe/Minsk'],
        'BZ' => ['BZD', 'America/Belize'], 'CA' => ['CAD', 'America/Toronto'], 'CD' => ['CDF', 'Africa/Kinshasa'],
        'CF' => ['XAF', 'Africa/Bangui'], 'CG' => ['XAF', 'Africa/Brazzaville'], 'CH' => ['CHF', 'Europe/Zurich'],
        'CI' => ['XOF', 'Africa/Abidjan'], 'CL' => ['CLP', 'America/Santiago'], 'CM' => ['XAF', 'Africa/Douala'],
        'CN' => ['CNY', 'Asia/Shanghai'], 'CO' => ['COP', 'America/Bogota'], 'CR' => ['CRC', 'America/Costa_Rica'],
        'CU' => ['CUP', 'America/Havana'], 'CV' => ['CVE', 'Atlantic/Cape_Verde'], 'CY' => ['TRY', 'Asia/Nicosia'],
        'CZ' => ['CZK', 'Europe/Prague'], 'DE' => ['EUR', 'Europe/Berlin'], 'DJ' => ['DJF', 'Africa/Djibouti'],
        'DK' => ['DKK', 'Europe/Copenhagen'], 'DM' => ['XCD', 'America/Dominica'], 'DO' => ['DOP', 'America/Santo_Domingo'],
        'DZ' => ['DZD', 'Africa/Algiers'], 'EC' => ['USD', 'America/Guayaquil'], 'EE' => ['EUR', 'Europe/Tallinn'],
        'EG' => ['EGP', 'Africa/Cairo'], 'ER' => ['ERN', 'Africa/Asmara'], 'ES' => ['EUR', 'Europe/Madrid'],
        'ET' => ['ETB', 'Africa/Addis_Ababa'], 'FI' => ['EUR', 'Europe/Helsinki'], 'FJ' => ['FJD', 'Pacific/Fiji'],
        'FM' => ['USD', 'Pacific/Pohnpei'], 'FO' => ['DKK', 'Atlantic/Faroe'], 'FR' => ['EUR', 'Europe/Paris'],
        'GA' => ['XAF', 'Africa/Libreville'], 'GB' => ['GBP', 'Europe/London'], 'GD' => ['XCD', 'America/Grenada'],
        'GE' => ['GEL', 'Asia/Tbilisi'], 'GF' => ['EUR', 'America/Cayenne'], 'GG' => ['GBP', 'Europe/Guernsey'],
        'GH' => ['GHS', 'Africa/Accra'], 'GI' => ['GIP', 'Europe/Gibraltar'], 'GL' => ['DKK', 'America/Nuuk'],
        'GM' => ['GMD', 'Africa/Banjul'], 'GN' => ['GNF', 'Africa/Conakry'], 'GP' => ['EUR', 'America/Guadeloupe'],
        'GQ' => ['XAF', 'Africa/Malabo'], 'GR' => ['EUR', 'Europe/Athens'], 'GT' => ['GTQ', 'America/Guatemala'],
        'GU' => ['USD', 'Pacific/Guam'], 'GW' => ['XOF', 'Africa/Bissau'], 'GY' => ['GYD', 'America/Guyana'],
        'HK' => ['HKD', 'Asia/Hong_Kong'], 'HN' => ['HNL', 'America/Tegucigalpa'], 'HR' => ['EUR', 'Europe/Zagreb'],
        'HT' => ['HTG', 'America/Port-au-Prince'], 'HU' => ['HUF', 'Europe/Budapest'], 'ID' => ['IDR', 'Asia/Jakarta'],
        'IE' => ['EUR', 'Europe/Dublin'], 'IL' => ['ILS', 'Asia/Jerusalem'], 'IM' => ['GBP', 'Europe/Isle_of_Man'],
        'IN' => ['INR', 'Asia/Kolkata'], 'IQ' => ['IQD', 'Asia/Baghdad'], 'IR' => ['IRR', 'Asia/Tehran'],
        'IS' => ['ISK', 'Atlantic/Reykjavik'], 'IT' => ['EUR', 'Europe/Rome'], 'JE' => ['GBP', 'Europe/Jersey'],
        'JM' => ['JMD', 'America/Jamaica'], 'JO' => ['JOD', 'Asia/Amman'], 'JP' => ['JPY', 'Asia/Tokyo'],
        'KE' => ['KES', 'Africa/Nairobi'], 'KG' => ['KGS', 'Asia/Bishkek'], 'KH' => ['KHR', 'Asia/Phnom_Penh'],
        'KI' => ['AUD', 'Pacific/Tarawa'], 'KM' => ['KMF', 'Indian/Comoro'], 'KN' => ['XCD', 'America/St_Kitts'],
        'KP' => ['KPW', 'Asia/Pyongyang'], 'KR' => ['KRW', 'Asia/Seoul'], 'KW' => ['KWD', 'Asia/Kuwait'],
        'KY' => ['KYD', 'America/Cayman'], 'KZ' => ['KZT', 'Asia/Almaty'], 'LA' => ['LAK', 'Asia/Vientiane'],
        'LB' => ['LBP', 'Asia/Beirut'], 'LC' => ['XCD', 'America/St_Lucia'], 'LI' => ['CHF', 'Europe/Vaduz'],
        'LK' => ['LKR', 'Asia/Colombo'], 'LR' => ['LRD', 'Africa/Monrovia'], 'LS' => ['LSL', 'Africa/Maseru'],
        'LT' => ['EUR', 'Europe/Vilnius'], 'LU' => ['EUR', 'Europe/Luxembourg'], 'LV' => ['EUR', 'Europe/Riga'],
        'LY' => ['LYD', 'Africa/Tripoli'], 'MA' => ['MAD', 'Africa/Casablanca'], 'MC' => ['EUR', 'Europe/Monaco'],
        'MD' => ['MDL', 'Europe/Chisinau'], 'ME' => ['EUR', 'Europe/Podgorica'], 'MG' => ['MGA', 'Indian/Antananarivo'],
        'MH' => ['USD', 'Pacific/Majuro'], 'MK' => ['MKD', 'Europe/Skopje'], 'ML' => ['XOF', 'Africa/Bamako'],
        'MM' => ['MMK', 'Asia/Yangon'], 'MN' => ['MNT', 'Asia/Ulaanbaatar'], 'MO' => ['MOP', 'Asia/Macau'],
        'MQ' => ['EUR', 'America/Martinique'], 'MR' => ['MRU', 'Africa/Nouakchott'], 'MT' => ['EUR', 'Europe/Malta'],
        'MU' => ['MUR', 'Indian/Mauritius'], 'MV' => ['MVR', 'Indian/Maldives'], 'MW' => ['MWK', 'Africa/Blantyre'],
        'MX' => ['MXN', 'America/Mexico_City'], 'MY' => ['MYR', 'Asia/Kuala_Lumpur'], 'MZ' => ['MZN', 'Africa/Maputo'],
        'NA' => ['NAD', 'Africa/Windhoek'], 'NC' => ['XPF', 'Pacific/Noumea'], 'NE' => ['XOF', 'Africa/Niamey'],
        'NG' => ['NGN', 'Africa/Lagos'], 'NI' => ['NIO', 'America/Managua'], 'NL' => ['EUR', 'Europe/Amsterdam'],
        'NO' => ['NOK', 'Europe/Oslo'], 'NP' => ['NPR', 'Asia/Kathmandu'], 'NR' => ['AUD', 'Pacific/Nauru'],
        'NZ' => ['NZD', 'Pacific/Auckland'], 'OM' => ['OMR', 'Asia/Muscat'], 'PA' => ['PAB', 'America/Panama'],
        'PE' => ['PEN', 'America/Lima'], 'PF' => ['XPF', 'Pacific/Tahiti'], 'PG' => ['PGK', 'Pacific/Port_Moresby'],
        'PH' => ['PHP', 'Asia/Manila'], 'PK' => ['PKR', 'Asia/Karachi'], 'PL' => ['PLN', 'Europe/Warsaw'],
        'PR' => ['USD', 'America/Puerto_Rico'], 'PS' => ['ILS', 'Asia/Gaza'], 'PT' => ['EUR', 'Europe/Lisbon'],
        'PW' => ['USD', 'Pacific/Palau'], 'PY' => ['PYG', 'America/Asuncion'], 'QA' => ['QAR', 'Asia/Qatar'],
        'RE' => ['EUR', 'Indian/Reunion'], 'RO' => ['RON', 'Europe/Bucharest'], 'RS' => ['RSD', 'Europe/Belgrade'],
        'RU' => ['RUB', 'Europe/Moscow'], 'RW' => ['RWF', 'Africa/Kigali'], 'SA' => ['SAR', 'Asia/Riyadh'],
        'SB' => ['SBD', 'Pacific/Guadalcanal'], 'SC' => ['SCR', 'Indian/Mahe'], 'SD' => ['SDG', 'Africa/Khartoum'],
        'SE' => ['SEK', 'Europe/Stockholm'], 'SG' => ['SGD', 'Asia/Singapore'], 'SI' => ['EUR', 'Europe/Ljubljana'],
        'SK' => ['EUR', 'Europe/Bratislava'], 'SL' => ['SLE', 'Africa/Freetown'], 'SM' => ['EUR', 'Europe/San_Marino'],
        'SN' => ['XOF', 'Africa/Dakar'], 'SO' => ['SOS', 'Africa/Mogadishu'], 'SR' => ['SRD', 'America/Paramaribo'],
        'SS' => ['SSP', 'Africa/Juba'], 'ST' => ['STN', 'Africa/Sao_Tome'], 'SV' => ['USD', 'America/El_Salvador'],
        'SY' => ['SYP', 'Asia/Damascus'], 'SZ' => ['SZL', 'Africa/Mbabane'], 'TD' => ['XAF', 'Africa/Ndjamena'],
        'TG' => ['XOF', 'Africa/Lome'], 'TH' => ['THB', 'Asia/Bangkok'], 'TJ' => ['TJS', 'Asia/Dushanbe'],
        'TL' => ['USD', 'Asia/Dili'], 'TM' => ['TMT', 'Asia/Ashgabat'], 'TN' => ['TND', 'Africa/Tunis'],
        'TO' => ['TOP', 'Pacific/Tongatapu'], 'TR' => ['TRY', 'Europe/Istanbul'], 'TT' => ['TTD', 'America/Port_of_Spain'],
        'TV' => ['AUD', 'Pacific/Funafuti'], 'TW' => ['TWD', 'Asia/Taipei'], 'TZ' => ['TZS', 'Africa/Dar_es_Salaam'],
        'UA' => ['UAH', 'Europe/Kyiv'], 'UG' => ['UGX', 'Africa/Kampala'], 'US' => ['USD', 'America/New_York'],
        'UY' => ['UYU', 'America/Montevideo'], 'UZ' => ['UZS', 'Asia/Tashkent'], 'VA' => ['EUR', 'Europe/Vatican'],
        'VC' => ['XCD', 'America/St_Vincent'], 'VE' => ['VES', 'America/Caracas'], 'VG' => ['USD', 'America/Tortola'],
        'VI' => ['USD', 'America/St_Thomas'], 'VN' => ['VND', 'Asia/Ho_Chi_Minh'], 'VU' => ['VUV', 'Pacific/Efate'],
        'WS' => ['WST', 'Pacific/Apia'], 'XK' => ['EUR', 'Europe/Belgrade'], 'YE' => ['YER', 'Asia/Aden'],
        'ZA' => ['ZAR', 'Africa/Johannesburg'], 'ZM' => ['ZMW', 'Africa/Lusaka'], 'ZW' => ['ZWL', 'Africa/Harare'],
    ];
}
