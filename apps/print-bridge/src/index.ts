import iconv from 'iconv-lite';
import { ComiqrApi } from './api.js';
import { loadConfig } from './config.js';
import { DEFAULT_RENDER, renderTicket } from './escpos.js';
import { sendToPrinter } from './transport.js';
import type { PrintJob } from './types.js';

/**
 * ComiQR yerel fiş köprüsü.
 *
 * İşletmenin kendi ağında çalışır: kuyruktaki fişleri çeker, ESC/POS baytlarına
 * çevirir, yazıcıya gönderir ve sonucu bildirir. Sunucu hangi fişin nereye
 * gideceğine karar verir; bu program yalnızca kâğıda basar.
 *
 * Tasarım kuralı: mutfak gecesinin ortasında SUSMAMAK. Ağ koptu, yazıcı kapandı,
 * jeton düştü — hepsi loglanır, iş kuyrukta "başarısız" olarak durur ve döngü
 * devam eder. Program kendi kendine ölmez.
 */

const stamp = () => new Date().toLocaleTimeString('tr-TR', { hour12: false });
const log = (msg: string) => console.log(`[${stamp()}] ${msg}`);
const warn = (msg: string) => console.warn(`[${stamp()}] ${msg}`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function handleJob(api: ComiqrApi, job: PrintJob, config: Awaited<ReturnType<typeof loadConfig>>): Promise<void> {
  const target = config.targetOverride ?? job.printer?.target ?? null;
  const label = `#${job.id} ${job.printer?.name ?? '?'} (${job.type})`;

  const payload = { ...job.payload_json, copies: job.printer?.copies ?? job.payload_json?.copies ?? 1 };
  const bytes = renderTicket(payload, config.render);

  if (config.dryRun) {
    // Donanımsız deneme: baytları değil, insanın okuyabileceği hâlini göster.
    log(`${label} — KURU ÇALIŞMA (${bytes.length} bayt)`);
    console.log(preview(bytes, config.render.codepageIconv ?? DEFAULT_RENDER.codepageIconv));
    await api.ack(job.id, true);

    return;
  }

  if (!target) {
    warn(`${label} — yazıcı hedefi tanımsız, panelde 'Hedef' alanını doldurun`);
    await api.ack(job.id, false, 'Yazıcı hedefi tanımsız');

    return;
  }

  try {
    await sendToPrinter(target, bytes);
    await api.ack(job.id, true);
    log(`${label} → ${target} basıldı`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    warn(`${label} → ${target} BASILAMADI: ${message}`);
    // Kuyrukta kalsın: panelden "Tekrar dene" ile yeniden sıraya alınabilir.
    await api.ack(job.id, false, message);
  }
}

/** Kontrol baytlarını ayıklayıp fişin okunur özetini verir (kuru çalışma için). */
function preview(bytes: Buffer, encoding: string): string {
  const text = iconv.encodingExists(encoding) ? iconv.decode(bytes, encoding) : bytes.toString('latin1');

  return text
    .replace(/\x1b@|\x1bt[\s\S]/g, '')
    .replace(/\x1b[aE][\s\S]/g, '')
    .replace(/\x1d![\s\S]/g, '')
    .replace(/\x1bd[\s\S]|\x1dV[\s\S]/g, '')
    .split('\n')
    .map((l) => `    │ ${l}`)
    .join('\n');
}

async function main(): Promise<void> {
  const config = await loadConfig(process.argv.slice(2));
  const api = new ComiqrApi(config.apiUrl, config.email, config.password);

  log(`ComiQR fiş köprüsü başladı — ${config.apiUrl}${config.dryRun ? ' (kuru çalışma)' : ''}`);
  if (config.printerId) log(`Yalnız ${config.printerId} numaralı yazıcının kuyruğu izleniyor.`);

  let quiet = false; // aynı hatayı her turda tekrar yazmamak için

  for (;;) {
    try {
      const jobs = await api.pending(config.printerId);
      if (jobs.length > 0) {
        log(`${jobs.length} fiş alındı`);
        for (const job of jobs) {
          await handleJob(api, job, config);
        }
      }
      quiet = false;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!quiet) {
        warn(`Kuyruğa ulaşılamıyor: ${message} — denemeye devam ediliyor`);
        quiet = true;
      }
    }

    await sleep(Math.max(1, config.pollSeconds) * 1000);
  }
}

main().catch((e) => {
  console.error(`[${stamp()}] Başlatılamadı: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
