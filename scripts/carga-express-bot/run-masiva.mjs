import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { CargaExpressMasivaBot } from './bot-masiva.mjs';
import { createDriver } from './utils/driver.mjs';
import { resolveBaseUrl } from './utils/urls.mjs';
import { requireMasivaFolders, resolveListedPeriods } from './utils/period-folders.mjs';
import {
  DEFAULT_MASIVA_STATUS_CSV,
  loadOrCreateMasivaCsv,
  markMasivaLoginFailure,
  syncMasivaPeriods,
} from './utils/status-masiva.mjs';
import { normalizeStatusMessages, saveStatusCsv } from './utils/status-csv.mjs';

const BOT_DIR = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(BOT_DIR, '.env') });

function parseArgs(argv) {
  const args = {
    local: false,
    limit: Infinity,
    folder: null,
    csv: DEFAULT_MASIVA_STATUS_CSV,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--local') args.local = true;
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--folder') args.folder = argv[++i];
    else if (arg === '--csv') args.csv = path.resolve(argv[++i]);
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Argumento desconocido: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node run-masiva.mjs [options]

Options:
  --local           Use http://localhost:4200 (wins over BASE_URL in .env)
  --limit <n>       Process at most n pending folders
  --folder <name>   Only this period folder (must be in MASIVA_FOLDERS)
  --csv <path>      Status CSV (default: scripts/telepeaje plus/status-masiva.csv)
  --help            Show this help

Env (scripts/carga-express-bot/.env):
  IBARRA_EMAIL
  IBARRA_PASSWORD
  MASIVA_FOLDERS      required allowlist, e.g. 202601-2,202602-1
  MASIVA_PLANTILLA    default MASIVOOO
  MASIVA_AI_TIMEOUT_MS  default 480000 (8 min)
  BASE_URL            optional origin when --local is not set
`);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} en scripts/carga-express-bot/.env`);
  return value;
}

function printStatusSummary(store, bot) {
  if (!store) return;
  const counts = { USER_INPUT: 0, COMPLETE: 0, FAILED: 0, DUPLICATED: 0, PENDING: 0 };
  for (const record of store.records) {
    const status = String(record.uploadFileStatus ?? '').trim().toUpperCase();
    if (status === 'USER_INPUT') counts.USER_INPUT += 1;
    else if (status === 'COMPLETE') counts.COMPLETE += 1;
    else if (status === 'FAILED') counts.FAILED += 1;
    else if (status === 'DUPLICATED') counts.DUPLICATED += 1;
    else counts.PENDING += 1;
  }
  const session = bot?.getSessionReport?.().summary;
  console.log(`\n--- Estado`);
  console.log(`USERINPUT: ${counts.USER_INPUT} (Por ver)`);
  console.log(`COMPLETED: ${counts.COMPLETE}`);
  console.log(`FAILED: ${counts.FAILED}`);
  console.log(`DUPLICATED: ${counts.DUPLICATED}`);
  console.log(`PENDING: ${counts.PENDING}`);
  if (session) console.log(`MISSING/ERRORS: ${session.missing}/${session.errors}`);
  console.log(`--`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  let driver;
  let store;
  let bot;
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
    } else {
      const email = requireEnv('IBARRA_EMAIL');
      const password = requireEnv('IBARRA_PASSWORD');
      const folders = requireMasivaFolders(process.env.MASIVA_FOLDERS);
      if (args.folder && !folders.includes(args.folder)) {
        throw new Error(
          `--folder ${args.folder} no está en MASIVA_FOLDERS (${folders.join(', ')}). Agregalo al .env o elegí una carpeta de la lista.`,
        );
      }
      const plantilla = process.env.MASIVA_PLANTILLA?.trim() || 'MASIVOOO';
      const aiTimeoutMs = Number(process.env.MASIVA_AI_TIMEOUT_MS) || 480000;
      const baseUrl = resolveBaseUrl({ local: args.local, envBaseUrl: process.env.BASE_URL });
      console.log(`URL: ${baseUrl}/peajes/carga-express`);
      console.log(`Plantilla: ${plantilla}`);
      console.log(`Carpetas: ${folders.join(', ')}`);
      if (args.local) {
        try {
          const response = await fetch(baseUrl, { method: 'GET' });
          if (!response.ok && response.status >= 500) {
            throw new Error(`localhost responded ${response.status}`);
          }
        } catch {
          throw new Error(
            `ng serve no responde en ${baseUrl}. Arrancá ibarra-app (pnpm ng serve) y reintentá --local.`,
          );
        }
      }
      if (!fs.existsSync(path.join(BOT_DIR, '.env'))) {
        console.warn('No hay .env: copiá .env.example a .env y cargá IBARRA_EMAIL / IBARRA_PASSWORD / MASIVA_FOLDERS.');
      }
      const periods = resolveListedPeriods(folders);
      for (const period of periods) {
        if (!period.ok) console.log(`SKIP ${period.folder}: ${period.reason}`);
        else console.log(`OK ${period.folder}: ${path.basename(period.xlsx)} + ${period.pdfs.length} PDF`);
      }
      store = loadOrCreateMasivaCsv(args.csv);
      syncMasivaPeriods(store, periods);
      const ignored = store.records.filter((record) => !folders.includes(String(record.folder ?? '').trim()));
      for (const record of ignored) {
        console.log(`IGNORO ${record.folder}: no está en MASIVA_FOLDERS`);
      }
      if (normalizeStatusMessages(store)) {
        saveStatusCsv(store);
        console.log('Mensajes de estado normalizados.');
      }
      console.log(`CSV: ${store.filePath} (${store.records.length} filas, ${folders.length} en allowlist)`);
      driver = await createDriver();
      bot = new CargaExpressMasivaBot({
        driver,
        store,
        baseUrl,
        email,
        password,
        limit: Number.isFinite(args.limit) ? args.limit : Infinity,
        folderFilter: args.folder,
        allowedFolders: folders,
        plantilla,
        aiTimeoutMs,
      });
      await bot.run();
      printStatusSummary(store, bot);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (store) {
      try {
        markMasivaLoginFailure(store, message);
      } catch (csvError) {
        console.error(`No pude actualizar status-masiva.csv: ${csvError instanceof Error ? csvError.message : csvError}`);
      }
    }
    printStatusSummary(store, bot);
    process.exitCode = 1;
  } finally {
    if (driver) await driver.quit().catch(() => {});
  }
}
