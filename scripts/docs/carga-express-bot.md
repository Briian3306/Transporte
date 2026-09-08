# Carga-express Selenium upload bot

Standalone Node + Selenium bot that uploads Telepase CSV/PDF pairs into
`/peajes/carga-express` using `scripts/downloads/status.csv`.

That CSV is **not** created by the downloader. Build it from `scripts/telepase/rows.json`:

```powershell
cd scripts/telepase
node build-status-csv.mjs
```

For Telepeaje Plus **importación masiva** (one Excel + many PDFs per period),
see [`carga-express-masiva-bot.md`](./carga-express-masiva-bot.md).

This is **not** part of the Angular runtime. It does not modify `ibarra-app/`.

## What it does

For each pending row in `status.csv`:

1. Logs into Ibarra (`IBARRA_EMAIL` / `IBARRA_PASSWORD`).
2. Uploads `filePasadasPath` + `fileFacturaPath`.
3. Selects **Empresa** then **Plantilla**.
4. Continues. Estaciones may be skipped by the app when all codes match.
5. If estaciones or patentes need a human decision, parks that tab, fires a
   Windows MessageBox, writes `USER_INPUT`, and continues with the next row.
6. Waits for invoice AI on `data-testid="invoice-ai-loader"` / `app-ai-cat-loader`
   (25–45s typical), retries up to 3 times, then reloads the same row up to 3 times.
   Logs `[AI] <numero> state=… chips=…` when suggestions settle.
7. Fills factura fields from AI chips + CSV (`numero`, `fechaEmision`, `monto`).
8. Confirms the load and writes `uploadFileStatus=COMPLETE`.

If Paso 7 is invalid or does not advance, the bot restarts that row from Paso 1
up to twice. The third failure writes `uploadFileStatus=FAILED` and processing
continues with the next row.

If Paso 8 validation is blocked because of an invoice/pass difference or row
errors, the bot writes `FAILED` with the validation status and continues with
the next row; it does not leave the row parked as `USER_INPUT`.

Statuses written to `uploadFileStatus`: `IN_PROGRESS`, `COMPLETE`, `FAILED`, `DUPLICATED`, `USER_INPUT`.
`messageStatus` describes the exact field, station decision, or login error.

Duplicate detections are terminal: the bot writes `DUPLICATED`, does not retry
the row, and skips it in future executions. Each execution prints one compact
summary with completed rows, failures, duplicates, pending rows, missing files,
and session errors; it does not dump all records to the console.

If login fails, the first pending row is marked `FAILED` with the login error so the CSV updates even before a file is uploaded. If Excel has `status.csv` open and Windows locks it, the bot writes `status.bot.csv` next to it.

## Install

```powershell
cd scripts/carga-express-bot
copy .env.example .env
# edit .env with IBARRA_EMAIL and IBARRA_PASSWORD
npm install
```

The account must have `peajes:manage`.

## Run

```powershell
cd scripts/carga-express-bot
node run.mjs
node run.mjs --local
node run.mjs --limit 1 --row 5009A02010049
```

| Flag | Meaning |
|---|---|
| `--local` | Always `http://localhost:4200` (wins over `BASE_URL` in `.env`). Requires `ng serve` up; fails fast if `:4200` is down. Use this when local OpenRouter keys differ from production. |
| `--limit n` | At most n pending rows |
| `--row numero` | Only this invoice `numero` |
| `--csv path` | Alternate status CSV |

Default URL: `https://portal.tpteibarra.ar/peajes/carga-express`.
`BASE_URL` in `.env` only applies when `--local` is **not** set.

Chrome runs **headed**. Do not close the window the bot opens.

The automatic selector only executes rows whose `uploadFileStatus` is
`FAILED` or `USER_INPUT`. Rows with `COMPLETE`, `IN_PROGRESS`, blank, or any
other status are skipped.

There is no bot-imposed parked-tab limit. Each manual `USER_INPUT` row keeps
its own tab while other eligible rows continue processing. Chrome/Windows
resource limits still apply.

Provider failover is tracked in memory by normalized `Empresa`. Five
consecutive terminal failures temporarily skip that provider when another
provider has eligible rows. A successful row resets the counter. If the
provider is the only eligible one remaining, it continues being attempted.

## Tests

```powershell
cd scripts/carga-express-bot
npm test
```

## USER_INPUT

Every parked row keeps its own tab; there is no two-tab cap. The bot continues
processing other eligible rows while these tabs wait for manual completion.

Windows shows a MessageBox and the terminal prints the same text. The bot
keeps that wizard tab open and starts the next CSV row in a
new tab. When you click Continuar after fixing estaciones/factura/validación,
the bot resumes that tab.
