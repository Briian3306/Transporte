/**
 * Download factura/pasada files after Telepase login.
 *
 * Prefer Playwright download events (factura opens PDF / pasada auto-saves),
 * fall back to context.request.get() with the authenticated session.
 *
 * Usage:
 *   node download-batch.mjs --limit 3 --diverse
 *   node download-batch.mjs --prefer SANTAFE,AUSA,AUMESA --limit 3
 *   node download-batch.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { ensureAuth } from './login.mjs';
import { loadRowsFromDisk } from './parse-facturas.mjs';
import {
  AUTH_JSON_PATH,
  DOWNLOADS_DIR,
  ERRORS_CSV_PATH,
  TELEPASE_DIR,
} from './paths.mjs';

dotenv.config({ path: path.join(TELEPASE_DIR, '.env') });

function parseArgs(argv) {
  const args = {
    limit: null,
    diverse: false,
    prefer: [],
    headless: process.env.HEADLESS !== '0',
    noAuth: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') {
      const n = Number(argv[++i]);
      args.limit = Number.isFinite(n) ? n : null;
    } else if (a.startsWith('--limit=')) {
      args.limit = Number(a.split('=')[1]);
    } else if (a === '--diverse') {
      args.diverse = true;
    } else if (a === '--prefer') {
      args.prefer = String(argv[++i] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a.startsWith('--prefer=')) {
      args.prefer = a
        .slice('--prefer='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === '--headed') {
      args.headless = false;
    } else if (a === '--no-auth') {
      // Public download URLs (no Telepase login)
      args.noAuth = true;
    }
  }
  if (args.limit === 0) args.limit = null;
  return args;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay() {
  return 300 + Math.floor(Math.random() * 301);
}

function sanitizeFolder(name) {
  return String(name || 'UNKNOWN').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'UNKNOWN';
}

function existingMatch(dir, prefix) {
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find((f) => f.startsWith(`${prefix}.`));
  return hit ? path.join(dir, hit) : null;
}

function extFromHeaders(headers) {
  const cd = headers['content-disposition'] || headers['Content-Disposition'] || '';
  const filenameMatch =
    /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(cd);
  const filename = decodeURIComponent(
    (filenameMatch?.[1] || filenameMatch?.[2] || filenameMatch?.[3] || '').trim()
  );
  if (filename && path.extname(filename)) {
    return path.extname(filename).toLowerCase();
  }

  const ct = (headers['content-type'] || headers['Content-Type'] || '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  const map = {
    'application/pdf': '.pdf',
    'text/csv': '.csv',
    'application/csv': '.csv',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'text/plain': '.csv', // Telepase pasadas often return text/plain CSV
    'application/zip': '.zip',
    'application/octet-stream': '.bin',
  };
  return map[ct] || '.bin';
}

function extFromBytes(body, kind) {
  if (body?.length >= 4 && body[0] === 0x25 && body[1] === 0x50 && body[2] === 0x44 && body[3] === 0x46) {
    return '.pdf'; // %PDF
  }
  const head = body?.subarray(0, 64)?.toString('utf8') || '';
  if (/^["']?[A-Za-z0-9_]+["']?,/.test(head) || head.includes(';') || head.includes(',')) {
    if (kind === 'pasadas') return '.csv';
  }
  return kind === 'facturas' ? '.pdf' : kind === 'pasadas' ? '.csv' : '.bin';
}

function isPdf(body) {
  return (
    body?.length >= 4 &&
    body[0] === 0x25 &&
    body[1] === 0x50 &&
    body[2] === 0x44 &&
    body[3] === 0x46
  );
}

function looksLikeHtmlLogin(body) {
  if (!body?.length) return true;
  if (isPdf(body)) return false;
  const text = body.subarray(0, 2000).toString('utf8');
  // Real download payloads (CSV) must not be treated as login HTML
  if (/^FECHA[;,]|^["']?FECHA/i.test(text) || text.includes('DISPOSITIVON')) return false;
  return /<!doctype html|<html[\s>]|Ingresá a tu cuenta|name=["']password["']/i.test(text);
}

async function downloadViaFetch(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: '*/*',
    },
  });
  const status = response.status;
  const headers = {};
  response.headers.forEach((v, k) => {
    headers[k] = v;
  });
  const ab = await response.arrayBuffer();
  const body = Buffer.from(ab);
  return { status, headers, body, ok: response.ok };
}

function ensureErrorsCsv() {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  if (!fs.existsSync(ERRORS_CSV_PATH)) {
    fs.writeFileSync(ERRORS_CSV_PATH, 'row_id,url,status_code\n', 'utf8');
  }
}

function logError(rowId, url, statusCode) {
  ensureErrorsCsv();
  const safe = `"${String(rowId).replace(/"/g, '""')}","${String(url).replace(/"/g, '""')}",${statusCode}\n`;
  fs.appendFileSync(ERRORS_CSV_PATH, safe, 'utf8');
}

function selectRows(rows, { limit, diverse, prefer }) {
  const withBoth = rows.filter((r) => r.facturaUrl && r.pasadaUrl);
  if (!limit) return withBoth;

  const picked = [];
  const seen = new Set();

  for (const code of prefer || []) {
    const hit = withBoth.find((r) => r.concesionario === code && !seen.has(r.concesionario));
    if (hit) {
      picked.push(hit);
      seen.add(hit.concesionario);
    }
    if (picked.length >= limit) return picked;
  }

  if (diverse || (prefer && prefer.length)) {
    for (const r of withBoth) {
      if (seen.has(r.concesionario)) continue;
      picked.push(r);
      seen.add(r.concesionario);
      if (picked.length >= limit) return picked;
    }
  }

  for (const r of withBoth) {
    if (picked.includes(r)) continue;
    picked.push(r);
    if (picked.length >= limit) break;
  }
  return picked;
}

async function downloadViaRequest(request, url) {
  const response = await request.get(url, { maxRedirects: 5, timeout: 120000 });
  const status = response.status();
  const headers = response.headers();
  const body = await response.body();
  return { status, headers, body, ok: response.ok() };
}

async function downloadViaPage(page, url) {
  // Pasadas usually trigger automatic download; facturas may open inline PDF.
  const downloadPromise = page.waitForEvent('download', { timeout: 45000 }).catch(() => null);
  const responsePromise = page
    .waitForResponse(
      (res) => res.url().includes('/admin/descargar-') && res.status() < 400,
      { timeout: 45000 }
    )
    .catch(() => null);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});

  const download = await downloadPromise;
  if (download) {
    const failure = await download.failure();
    if (failure) throw new Error(`Download failed: ${failure}`);
    const suggested = download.suggestedFilename();
    const stream = await download.createReadStream();
    const chunks = [];
    if (stream) {
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    } else {
      const tmp = path.join(DOWNLOADS_DIR, `.tmp-${Date.now()}-${suggested || 'file'}`);
      await download.saveAs(tmp);
      const buf = fs.readFileSync(tmp);
      fs.unlinkSync(tmp);
      return {
        status: 200,
        headers: {
          'content-disposition': `attachment; filename="${suggested || 'file'}"`,
        },
        body: buf,
        ok: true,
      };
    }
    return {
      status: 200,
      headers: {
        'content-disposition': `attachment; filename="${suggested || 'file'}"`,
      },
      body: Buffer.concat(chunks),
      ok: true,
    };
  }

  const response = await responsePromise;
  if (response) {
    const headers = response.headers();
    const body = await response.body();
    return { status: response.status(), headers, body, ok: response.ok() };
  }

  // Inline PDF navigated in-tab: pull via request using same cookies
  const viaReq = await page.context().request.get(url, { maxRedirects: 5, timeout: 120000 });
  return {
    status: viaReq.status(),
    headers: viaReq.headers(),
    body: await viaReq.body(),
    ok: viaReq.ok(),
  };
}

async function downloadOne(page, request, meta, stats, { noAuth = false } = {}) {
  const { rowId, url, concesionario, kind, periodo, numero } = meta;
  const folder = path.join(DOWNLOADS_DIR, sanitizeFolder(concesionario));
  const prefix = `${kind}_${periodo}_${numero}`;
  const existing = existingMatch(folder, prefix);
  if (existing) {
    stats.skipped++;
    console.log(`  SKIP existing ${existing}`);
    return { status: 'skipped', path: existing };
  }

  let lastStatus = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      let result;
      if (noAuth) {
        // Native fetch follows redirects cleanly for public Telepase URLs
        result = await downloadViaFetch(url);
      } else {
        result = await downloadViaRequest(request, url);
        if (!result.ok || looksLikeHtmlLogin(result.body)) {
          console.warn(
            `  Attempt ${attempt}/3 request not usable (status=${result.status}); trying page/fetch…`
          );
          try {
            result = await downloadViaPage(page, url);
          } catch (pageErr) {
            console.warn(`  Page download failed: ${pageErr.message}; trying fetch…`);
            result = await downloadViaFetch(url);
          }
        }
      }
      lastStatus = result.status;

      if (!result.ok || looksLikeHtmlLogin(result.body) || !result.body?.length) {
        console.warn(`  Attempt ${attempt}/3 failed status=${lastStatus} ${url}`);
        if (attempt < 3) await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }

      let ext = extFromHeaders(result.headers);
      if (ext === '.bin' || (kind === 'pasadas' && ext === '.txt')) {
        ext = extFromBytes(result.body, kind);
      }
      if (isPdf(result.body)) ext = '.pdf';

      const dest = path.join(folder, `${prefix}${ext}`);
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(dest, result.body);
      stats.saved++;
      console.log(
        `  SAVED ${dest} (${result.body.length} bytes, ${result.headers['content-type'] || ext})`
      );
      return { status: 'saved', path: dest, contentType: result.headers['content-type'] };
    } catch (err) {
      console.warn(`  Attempt ${attempt}/3 error: ${err.message}`);
      if (attempt < 3) await sleep(1000 * 2 ** (attempt - 1));
    }
  }

  logError(rowId, url, lastStatus);
  stats.failed++;
  console.error(`  FAIL row=${rowId} status=${lastStatus} ${url}`);
  return { status: 'failed', statusCode: lastStatus };
}

export async function runDownloadBatch(options = {}) {
  const args = { ...parseArgs([]), ...options };
  const allRows = loadRowsFromDisk();
  const rows = selectRows(allRows, args);

  console.log(`Total rows parsed: ${allRows.length}`);
  console.log(
    `Selected for download: ${rows.length}` +
      (args.limit
        ? ` (limit=${args.limit}${args.diverse ? ', diverse' : ''}${args.prefer?.length ? `, prefer=${args.prefer.join(',')}` : ''})`
        : ' (full)')
  );

  let browser = null;
  let page = null;
  let request = null;

  if (!args.noAuth) {
    await ensureAuth({ headless: args.headless });
    browser = await chromium.launch({ headless: args.headless });
    const context = await browser.newContext({
      storageState: AUTH_JSON_PATH,
      acceptDownloads: true,
    });
    page = await context.newPage();
    request = context.request;
  } else {
    console.log('Running with --no-auth (public download URLs via fetch)');
  }

  const stats = {
    totalRows: allRows.length,
    selectedRows: rows.length,
    saved: 0,
    skipped: 0,
    failed: 0,
    missingUrls: allRows.filter((r) => !r.facturaUrl && !r.pasadaUrl).length,
  };

  ensureErrorsCsv();

  for (const row of rows) {
    console.log(
      `\n[${row.concesionario}] ${row.numero} periodo=${row.periodo} estado=${row.estado}`
    );
    const base = {
      rowId: `${row.rowId}|${row.numero}`,
      concesionario: row.concesionario,
      periodo: row.periodo,
      numero: row.numero,
    };

    if (row.facturaUrl) {
      await downloadOne(
        page,
        request,
        { ...base, url: row.facturaUrl, kind: 'facturas' },
        stats,
        { noAuth: args.noAuth }
      );
      await sleep(randomDelay());
    }
    if (row.pasadaUrl) {
      await downloadOne(
        page,
        request,
        { ...base, url: row.pasadaUrl, kind: 'pasadas' },
        stats,
        { noAuth: args.noAuth }
      );
      await sleep(randomDelay());
    }
  }

  if (browser) await browser.close();

  console.log('\n========== SUMMARY ==========');
  console.log(`Total rows:          ${stats.totalRows}`);
  console.log(`Selected rows:       ${stats.selectedRows}`);
  console.log(`Files saved:         ${stats.saved}`);
  console.log(`Files skipped:       ${stats.skipped}`);
  console.log(`Files failed:        ${stats.failed}`);
  console.log(`Rows missing URLs:   ${stats.missingUrls}`);
  console.log('=============================');

  return stats;
}

const isMain =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  runDownloadBatch(args)
    .then((stats) => process.exit(stats.failed > 0 ? 2 : 0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
