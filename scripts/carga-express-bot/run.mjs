import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { CargaExpressBot } from './bot.mjs';
import { createDriver } from './utils/driver.mjs';
import { DEFAULT_STATUS_CSV, loadStatusCsv, markLoginFailure } from './utils/status-csv.mjs';

const BOT_DIR = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(BOT_DIR, '.env') });

const PRODUCTION = 'https://portal.tpteibarra.ar';
const LOCAL = 'http://localhost:4200';

function parseArgs(argv) {
  const args = {
    local: false,
    limit: Infinity,
    row: null,
    csv: DEFAULT_STATUS_CSV,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--local') args.local = true;
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--row') args.row = argv[++i];
    else if (arg === '--csv') args.csv = path.resolve(argv[++i]);
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Argumento desconocido: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node run.mjs [options]

Options:
  --local         Use http://localhost:4200 instead of production
  --limit <n>     Process at most n pending rows
  --row <numero>  Only this invoice numero
  --csv <path>    Status CSV (default: scripts/downloads/status.csv)
  --help          Show this help

Env (scripts/carga-express-bot/.env):
  IBARRA_EMAIL
  IBARRA_PASSWORD
  BASE_URL          optional override (default production or --local)
`);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} en scripts/carga-express-bot/.env`);
  return value;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  let driver;
  let store;
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
    } else {
      const email = requireEnv('IBARRA_EMAIL');
      const password = requireEnv('IBARRA_PASSWORD');
      const baseUrl = process.env.BASE_URL?.trim() || (args.local ? LOCAL : PRODUCTION);
      if (!fs.existsSync(path.join(BOT_DIR, '.env'))) {
        console.warn('No hay .env: copiá .env.example a .env y cargá IBARRA_EMAIL / IBARRA_PASSWORD.');
      }
      store = loadStatusCsv(args.csv);
      console.log(`CSV: ${store.filePath} (${store.records.length} filas)`);
      driver = await createDriver();
      const bot = new CargaExpressBot({
        driver,
        store,
        baseUrl,
        email,
        password,
        limit: Number.isFinite(args.limit) ? args.limit : Infinity,
        rowFilter: args.row,
      });
      await bot.run();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (store) {
      try {
        markLoginFailure(store, message);
      } catch (csvError) {
        console.error(`No pude actualizar status.csv: ${csvError instanceof Error ? csvError.message : csvError}`);
      }
    }
    process.exitCode = 1;
  } finally {
    if (driver) await driver.quit().catch(() => {});
  }
}
