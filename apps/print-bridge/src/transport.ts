import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Baytları yazıcıya ulaştırır. Üç yol destekleniyor:
 *
 *  - `192.168.1.50:9100` — ağ yazıcısı (ham TCP). Mutfak/bar yazıcılarının
 *    çoğu böyle bağlanır; birincil yol budur.
 *  - `\KASA-PC\MUTFAK` — Windows paylaşımı. Node paylaşıma doğrudan yazamadığı
 *    için bayt geçici dosyaya alınır ve `copy /b` ile kuyruğa verilir.
 *  - `file:./cikti.bin` — donanımsız deneme; baytlar dosyaya yazılır.
 *
 * Hata fırlatır; çağıran tarafı bunu kuyruğa "başarısız" olarak bildirir, iş
 * kaybolmaz.
 */

/** Windows ag paylasimi (UNC) onu: iki ters bolu. Kaynakta kacis sorunu
 *  yasanmasin diye karakter kodundan uretilir. */
const BACKSLASH = String.fromCharCode(92);
const UNC_PREFIX = BACKSLASH + BACKSLASH;
/** C:\\ gibi surucu yolu. */
const DRIVE_PATH = new RegExp('^[a-zA-Z]:[' + BACKSLASH + BACKSLASH + '/]');

const TCP_TIMEOUT_MS = 8000;

export async function sendToPrinter(target: string, data: Buffer): Promise<void> {
  // Donanimsiz deneme: baytlari dosyaya yaz.
  if (target.startsWith('file:')) {
    return writeFile(target.slice('file:'.length), data);
  }

  // Windows paylasimi ya da surucu yolu.
  if (target.startsWith(UNC_PREFIX) || DRIVE_PATH.test(target)) {
    return sendToWindowsShare(target, data);
  }

  // Varsayilan: ag yazicisi, ham TCP.
  return sendOverTcp(target, data);
}

function parseHostPort(target: string): { host: string; port: number } {
  const at = target.lastIndexOf(':');
  if (at < 1) {
    return { host: target, port: 9100 };
  }

  const port = Number(target.slice(at + 1));

  return {
    host: target.slice(0, at),
    port: Number.isFinite(port) && port > 0 ? port : 9100,
  };
}

function sendOverTcp(target: string, data: Buffer): Promise<void> {
  const { host, port } = parseHostPort(target);

  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      error ? reject(error) : resolve();
    };

    socket.setTimeout(TCP_TIMEOUT_MS);
    socket.on('timeout', () => finish(new Error(`${host}:${port} yanıt vermedi (zaman aşımı)`)));
    socket.on('error', (e) => finish(new Error(`${host}:${port} bağlanılamadı — ${e.message}`)));
    socket.on('connect', () => {
      // Yazıcı baytları alsın diye akış boşaltıldıktan sonra kapatılır.
      socket.write(data, (e) => (e ? finish(e) : socket.end()));
    });
    socket.on('close', () => finish());
  });
}

async function sendToWindowsShare(target: string, data: Buffer): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'comiqr-print-'));
  const file = join(dir, 'ticket.bin');
  await writeFile(file, data);

  await new Promise<void>((resolve, reject) => {
    // `copy /b` ham baytları bozmadan yazıcı kuyruğuna verir.
    const child = spawn('cmd', ['/c', 'copy', '/b', file, target], { windowsHide: true });
    let stderr = '';

    child.stderr.on('data', (chunk) => (stderr += String(chunk)));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`copy başarısız (${code}) ${stderr.trim()}`)),
    );
  });
}
