import { readFile } from 'node:fs/promises';
import type { RenderOptions } from './escpos.js';

export type BridgeConfig = {
  apiUrl: string;
  email: string;
  password: string;
  /** Yalnız bu yazıcının kuyruğunu çek; boşsa işletmenin tüm yazıcıları. */
  printerId?: number;
  pollSeconds: number;
  /** Donanıma göndermeden ne basılacağını ekrana yaz. */
  dryRun: boolean;
  /** Yazıcı hedefini yapılandırmadan ez (panelde boşsa ya da sahada değiştiyse). */
  targetOverride?: string;
  render: Partial<RenderOptions>;
};

const DEFAULTS: BridgeConfig = {
  apiUrl: 'http://127.0.0.1:8000/v1',
  email: '',
  password: '',
  pollSeconds: 3,
  dryRun: false,
  render: {},
};

/**
 * Yapılandırma: dosya, sonra ortam değişkenleri, sonra komut satırı — sonraki
 * öncekini ezer. Sahada dosya, geliştirirken bayrak kullanmak kolay olsun diye.
 */
export async function loadConfig(argv: string[]): Promise<BridgeConfig> {
  const fileArg = valueOf(argv, '--config') ?? 'config.json';
  let fromFile: Partial<BridgeConfig> = {};

  try {
    fromFile = JSON.parse(await readFile(fileArg, 'utf8')) as Partial<BridgeConfig>;
  } catch {
    // Dosya yoksa sorun değil; ortam/bayrak ile de çalışır.
  }

  const env = process.env;
  const merged: BridgeConfig = {
    ...DEFAULTS,
    ...fromFile,
    ...clean({
      apiUrl: env.COMIQR_API_URL,
      email: env.COMIQR_EMAIL,
      password: env.COMIQR_PASSWORD,
      printerId: env.COMIQR_PRINTER_ID ? Number(env.COMIQR_PRINTER_ID) : undefined,
      targetOverride: env.COMIQR_TARGET,
    }),
    ...clean({
      apiUrl: valueOf(argv, '--api'),
      email: valueOf(argv, '--email'),
      password: valueOf(argv, '--password'),
      printerId: numberOf(argv, '--printer'),
      pollSeconds: numberOf(argv, '--poll'),
      targetOverride: valueOf(argv, '--target'),
      dryRun: argv.includes('--dry-run') ? true : undefined,
    }),
    render: { ...(fromFile.render ?? {}), ...clean({ width: numberOf(argv, '--width') }) },
  };

  if (!merged.dryRun && (!merged.email || !merged.password)) {
    throw new Error('E-posta ve parola gerekli (config.json, COMIQR_EMAIL/COMIQR_PASSWORD ya da --email/--password).');
  }

  return merged;
}

function clean<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;
}

function valueOf(argv: string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);

  return at >= 0 ? argv[at + 1] : undefined;
}

function numberOf(argv: string[], flag: string): number | undefined {
  const raw = valueOf(argv, flag);
  const n = Number(raw);

  return raw !== undefined && Number.isFinite(n) ? n : undefined;
}
