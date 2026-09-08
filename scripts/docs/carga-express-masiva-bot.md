# Carga-express masiva bot (Telepeaje Plus)

Standalone Node + Selenium bot that uploads period folders from
`scripts/telepeaje plus` into `/peajes/carga-express` using **Importación masiva**.

This is **not** part of the Angular runtime. It does not modify `ibarra-app/`.
It does not read `scripts/downloads/status.csv` (that file is for the simple bot).

## What it does

For each folder listed in `MASIVA_FOLDERS`:

1. Logs into Ibarra (`IBARRA_EMAIL` / `IBARRA_PASSWORD`).
2. Clicks **Importación masiva** on Paso 1.
3. Uploads `Consumo_*_MAPPED.xlsx` plus every PDF in `Comprobantes/`.
4. Selects plantilla `MASIVA_PLANTILLA` (default `MASIVOOO`). Empresa stays empty
   so Paso 7 can fill it from `Concesion`.
5. Continues. Estaciones may be skipped when all codes match.
6. If estaciones or patentes need a human decision, parks that tab, fires a
   Windows MessageBox, writes `USER_INPUT`, and continues with the next folder.
7. Waits until the invoice AI **queue is idle** (loader off, no `Analizando`,
   no `Con PDF`) and accordion pins (`paso7__acc-badge--ready` /
   `Sugerencias listas`) have been stable for ~10s. It does **not** require
   `ready ===` uploaded PDF count: unmatched PDFs never get a pin.
8. Expands each document accordion **by index** (`app-accordion-panel[1]` …
   `[n]`), waits for that panel’s children, and clicks the highest-confidence
   `.paso7__suggest` chips in that panel only. The first panel starts open;
   the others stay collapsed until this click.
9. Clicks **Confirmar carga** and **waits up to ~90s** (masiva 120s) for the
   success dialog (`app-paso9-revision` → `app-dialog` → `section.app-dialog`,
   title «Carga confirmada»). The green «Listo para confirmar» badge is not
   treated as done. After the dialog is visible (~5s so you can read it),
   clicks **Cargar otro archivo** and writes `uploadFileStatus=COMPLETE`.

If invoice AI is still running after `MASIVA_AI_TIMEOUT_MS`, the bot **keeps
waiting on that tab** (does not open the next folder). A hard cap of
`max(timeout×2, 20 min)` then parks `USER_INPUT` and still retries chips on
that tab when the queue goes idle.

If Paso 8 is blocked (including duplicate passes), the bot parks
`USER_INPUT`, **keeps the tab open**, and waits. It does not write
`DUPLICATED` or close the browser. After you click **Subir igualmente**
and/or **Continuar**, it resumes from Validación or Revisión.

If Paso 7 is invalid, the AI times out, or a badge stays on `Error IA`, the bot
**does not refresh** and **does not write `FAILED`**. It parks `USER_INPUT` and
keeps the tab open.

Statuses written to `scripts/telepeaje plus/status-masiva.csv`:
`IN_PROGRESS`, `COMPLETE`, `FAILED`, `DUPLICATED`, `USER_INPUT`.
`FAILED` is only used for login errors. Factura and Paso 8 duplicate problems stay `USER_INPUT`.

If Excel has the CSV open and Windows locks it, the bot writes
`status-masiva.bot.csv` next to it.

## Install

```powershell
cd scripts/carga-express-bot
copy .env.example .env
# edit .env with IBARRA_EMAIL, IBARRA_PASSWORD, and MASIVA_FOLDERS
npm install
```

The account must have `peajes:manage`.

## Folders (`.env`)

Only folders named in `MASIVA_FOLDERS` run. Extra rows already in
`status-masiva.csv` (for example `202602-1` after you removed it from `.env`)
are ignored and do **not** need a MAPPED file.

```env
MASIVA_FOLDERS=202601-2,202602-1,202603-1,202603-2,202604-1,202604-02,202605-01,202605-02,202606-01,202606-2
MASIVA_PLANTILLA=MASIVOOO
MASIVA_AI_TIMEOUT_MS=480000
```

Each name must match a directory under `scripts/telepeaje plus/`. Each folder
needs `Consumo_*_MAPPED.xlsx` and at least one `Comprobantes/*.pdf`.
`202601-1` is omitted because it is already uploaded. `202607-1` (no MAPPED)
and `202607-2` (PDFs not in `Comprobantes/`) stay out until you add them.

A listed folder missing those files is skipped for that run (log line, not
`FAILED`) and can be retried later.

## Run

```powershell
cd scripts/carga-express-bot
node run-masiva.mjs
node run-masiva.mjs --local
node run-masiva.mjs --limit 1 --folder 202601-2
```

| Flag | Meaning |
|---|---|
| `--local` | Always `http://localhost:4200` (wins over `BASE_URL` in `.env`). Requires `ng serve` up. |
| `--limit n` | At most n pending folders |
| `--folder name` | Only this period (must be in `MASIVA_FOLDERS`) |
| `--csv path` | Alternate status CSV |

Default URL: `https://portal.tpteibarra.ar/peajes/carga-express`.

Chrome runs **headed**. Do not close the window the bot opens.

Eligible statuses for a **new** tab: blank, `FAILED`, `USER_INPUT`, `PENDING`,
and leftover `IN_PROGRESS` (a previous run was killed). Skip `COMPLETE` and
`DUPLICATED`. If a folder is already parked in this session, the bot does not
open another tab for it.

## Tests

```powershell
cd scripts/carga-express-bot
npm test
```

## USER_INPUT

Every parked folder keeps its own tab. The bot continues processing other
eligible folders while these tabs wait for manual completion.

Windows shows a MessageBox and the terminal prints the same text. When you
click Continuar after fixing estaciones/factura/validación, the bot resumes
that tab.
