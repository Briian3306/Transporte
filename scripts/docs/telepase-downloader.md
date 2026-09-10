# Telepase Factura / Pasada Downloader

Downloads invoice PDFs and pasadas CSV files from Telepase download URLs listed in a saved HTML DataTables page.

**Standalone scripts track** (not Angular): agent coordination lives in [`claude-progress-script.md`](./claude-progress-script.md), [`../feature-list-script.json`](../feature-list-script.json), and skill [`../.agents/skills/telepase-scraper/SKILL.md`](../.agents/skills/telepase-scraper/SKILL.md).

## Purpose

1. Parse `scripts/html/facturas` (Telepase admin facturas table).
2. For each row, fetch:
   - Factura URL (`descargar-factura*`) → usually PDF
   - Pasada URL (`descargar-pasadas*`) → usually CSV (`text/plain`)
3. Save files under `scripts/downloads/{CONCESIONARIO}/`.

Example layout:

```text
scripts/downloads/
  SANTAFE/
    facturas_2025-09-24_993799.pdf
    pasadas_2025-09-24_993799.csv
  AUMESA/
    facturas_2026-02-28_212490.pdf
    pasadas_2026-02-28_212490.csv
```

Filename pattern: `{facturas|pasadas}_{periodo}_{numero}.{ext}`

Extension is taken from `Content-Type` / `Content-Disposition` (not hard-coded). Pasadas that return `text/plain` are saved as `.csv`.

`rows.json` also contains the local file metadata fields:

```json
{
  "fileFacturaPath": "scripts/downloads/AUSA/facturas_2026-06-23_5009A02010049.pdf",
  "filePasadasPath": "scripts/downloads/AUSA/pasadas_2026-06-23_5009A02010049.csv",
  "downloadedAt": "2026-09-10 10:46:32"
}
```

Paths are repository-relative and are matched using `concesionario`, `periodo`, and `numero`. Missing files are represented by `null`. The downloader updates these fields after saving a file or when it skips an existing file. `downloadedAt` is set only when a file is actually saved (not skipped). Older rows stay without a stamp. Re-parsing the HTML keeps previous `downloadedAt` values.

## Requirements

| Requirement | Notes |
|---|---|
| Node.js 18+ | ESM scripts |
| npm | Install deps in `scripts/telepase` |
| Playwright Chromium | Installed via `npx playwright install chromium` |
| Input HTML | `scripts/html/facturas` (saved Telepase facturas page) |
| Network | Access to `https://telepase.com.ar` |

Optional (only if URLs require session):

| Optional | Notes |
|---|---|
| `TELEPASE_USER` / `TELEPASE_PASS` | In env or `scripts/telepase/.env` |
| Login URL | `https://telepase.com.ar/login` (`/admin/login` returns 404) |

In practice:

- Operator-specific URLs (`/admin/descargar-factura-aumesa/...`, `...-vsfe/...`, etc.) usually work **without login** (`--no-auth`).
- Generic AUSA URLs (`/admin/descargar-factura/{numero}/DR/...`) often **require login** (unauthenticated requests redirect to `/dashboard`).
- Prefer `--no-auth` for the bulk run, then a second authenticated pass for remaining failures.

## Install

```powershell
cd scripts/telepase
npm install
npx playwright install chromium
```

Optional credentials:

```powershell
copy .env.example .env
# edit .env with TELEPASE_USER and TELEPASE_PASS
```

## Scripts

| File | Role |
|---|---|
| `parse-facturas.mjs` | Parse HTML → `rows.json` |
| `download-batch.mjs` | Download files (main CLI) |
| `build-status-csv.mjs` | Build `scripts/downloads/status.csv` from `rows.json` |
| `enrich-status-templates.mjs` | Extract station names from AUMESA invoice PDFs and fill `status.csv` |
| `login.mjs` | UI login + `auth.json` (storageState) |
| `login-via-cli.mjs` | Same via playwright-cli when available |
| `paths.mjs` | Shared paths |
| Carga-express bot | Upload CSV/PDF into Ibarra: [`carga-express-bot.md`](./carga-express-bot.md) |

## How to execute

### 1) Parse HTML only

```powershell
cd scripts/telepase
npm run parse
# or: node parse-facturas.mjs
```

Parsing initializes both path fields to `null` and keeps any previous `downloadedAt` stamps; running the downloader populates paths for files already present on disk as well as newly downloaded files.

### 1b) Build `status.csv` for the carga-express bot

The downloader does **not** write `status.csv`. After `rows.json` exists, generate it:

```powershell
cd scripts/telepase
node build-status-csv.mjs
# or: npm run status
```

Output: `scripts/downloads/status.csv`. Paths are filled from `rows.json` or by matching `facturas_*` / `pasadas_*` files already on disk. AUMESA `Template` stays blank until `enrich-status-templates.mjs`. Existing `uploadFileStatus` / `Template` / `fechaDescarga` values are kept unless you pass `--no-merge`. `fechaDescarga` is a report column (`YYYY-MM-DD HH:mm:ss` local); it is filled only for files saved after this field existed.

### 2) Pilot (3 rows, diverse concesionarios)

```powershell
cd scripts/telepase
node download-batch.mjs --no-auth --limit 3 --diverse
```

Or prefer specific operators:

```powershell
node download-batch.mjs --no-auth --limit 3 --prefer AUMESA,SANTAFE,AUSA
```

To download only invoices whose `periodo` month is in range (useful for AUMESA, which has many historical months):

```powershell
node download-batch.mjs --month-init 3 --month-finish 4
# aliases also work: --month_init 3 --mont_finish 4
```

March and April of any year in the HTML table are kept. Combine with `--prefer AUMESA` if you only want that operator.

### 3) Full batch (recommended two-pass)

```powershell
cd scripts/telepase

# Pass 1: public operator URLs (fast, no browser)
node download-batch.mjs --no-auth

# Pass 2: remaining files that need session (e.g. AUSA /admin/descargar-factura/...)
node login.mjs --force
node download-batch.mjs
```

Existing files are always skipped, so re-runs are safe.

To verify path matching without network access:

```powershell
node --test download-paths.test.mjs
```

Equivalent npm:

```powershell
npm run download -- --no-auth
npm run login
npm run download
```

### 4) Fill AUMESA templates from invoice PDFs

From `scripts/telepase`, install dependencies with `npm install`, then preview
classification without changing the CSV:

```powershell
node enrich-status-templates.mjs --dry-run
```

Apply templates to blank AUMESA rows in `scripts/downloads/status.csv`:

```powershell
node enrich-status-templates.mjs
```

The report is written to `scripts/downloads/status-template-report.json`. It records
matched, preserved, unknown, ambiguous, missing-PDF, and extraction-error rows.
The matcher recognizes `YEAU`, `YERAU`, and `YERUA` as
`MERCA-SUR-003-YERAU`, plus ZARATE, COLONIA, PIEDRITAS, and
`CAMINOS DE LAS SIERRAS` as `SOY-CORDOBES`. Description matches
have priority over locality matches, so an invoice with locality ZARATE and
description `YERUA-CAT` receives the YERAU template.

The monthly Caminos rows in `scripts/downloads/status.csv` use the invoice
month-end date as `fechaEmision` and point to the matching workbook in
`scripts/downloads/CAMINO DE LAS SIERRAS`. Add a row only when both its PDF and
the corresponding `.xlsx` are present; the June workbook and July invoice PDF
are currently missing from that folder.

### 5) Auth-only run

```powershell
cd scripts/telepase
node login.mjs --force
node download-batch.mjs
```

Using playwright-cli helpers (optional):

```powershell
# from repo root
npx @playwright/cli open https://telepase.com.ar/login
# fill credentials, then:
npx @playwright/cli state-save scripts/telepase/auth.json
```

### 5) Retry only previous failures

Reads unique URLs from `scripts/downloads/errors.csv` and retries just those:

```powershell
cd scripts/telepase
node login.mjs --force   # if AUSA / gated URLs
node download-batch.mjs --tryfailed
# or:
npm run retry-failed
```

On success, those URLs are removed from `errors.csv`. Still-failing URLs stay listed.

## CLI flags (`download-batch.mjs`)

| Flag | Description |
|---|---|
| `--limit N` | Only first N selected rows/URLs (`0` or omit = all) |
| `--diverse` | Prefer one row per concesionario when limiting |
| `--prefer A,B,C` | Prefer these concesionario codes first |
| `--month-init N` | Keep rows whose `periodo` month is ≥ N (`1`–`12`). Aliases: `--month_init` |
| `--month-finish N` | Keep rows whose `periodo` month is ≤ N (`1`–`12`). Aliases: `--month_finish`, `--mont_finish` |
| `--tryfailed` | Retry only unique failed URLs from `errors.csv` |
| `--no-auth` | Skip login; use public download URLs |
| `--headed` | Run browser headed (`HEADLESS=0` also works) |

## Behavior

- **Skip existing**: if `facturas_{periodo}_{numero}.*` or `pasadas_...` already exists, skip.
- **Retries**: up to 3 attempts with exponential backoff.
- **Delay**: random 300–600 ms between requests.
- **Progress file**: `rows.json` is written atomically every ~10 updates and again at the end. A Windows lock on that file warns and continues; it does not abort the batch.
- **Errors**: appended to `scripts/downloads/errors.csv` as `row_id,url,status_code`.
- **Summary**: prints total rows, saved, skipped, failed.

## Concesionario resolution

Folder name comes from, in order:

1. `data-concesionario` on the download `<a>`
2. URL slug (`descargar-factura-aumesa` → `AUMESA`; `vsfe` → `SANTAFE`)
3. Row CSS class (`filtro-tr AUMESA`)
4. Visible column text (fallback)

Some AUMESA rows omit `ga-descargar-*` classes; the parser also matches any `a[href*="descargar-factura"]` / `descargar-pasadas`.

## Refreshing the HTML source

1. Log in to Telepase autogestión.
2. Open Facturas, apply date/concesionario filters.
3. Save the page HTML as `scripts/html/facturas` (no extension required).
4. Re-run parse + download.

## Security

Do **not** commit:

- `scripts/telepase/.env`
- `scripts/carga-express-bot/.env`
- `scripts/telepase/auth.json`
- `scripts/downloads/**` (already gitignored except `.gitignore`)

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Missing TELEPASE_USER / TELEPASE_PASS` | Use `--no-auth`, or create `.env` |
| Login page 404 on `/admin/login` | Use `https://telepase.com.ar/login` |
| Probe / download timeouts | Cloudflare slowness; retry; or use `--no-auth` |
| HTML login body instead of PDF | Session expired → `node login.mjs --force` |
| 0 rows with URLs | Ensure `scripts/html/facturas` contains `table#example` |
| `UNKNOWN: unknown error, open '...rows.json'` | Windows lock (OneDrive/Cursor/antivirus). The downloader now retries atomically and continues; re-run to finish remaining files. |
