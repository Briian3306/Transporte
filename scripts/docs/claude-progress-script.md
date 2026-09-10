# Progreso de agentes — Telepase scraper (scripts)

Bitácora del **pipeline de extracción Telepase** (HTML → facturas PDF / pasadas CSV).

Este trabajo es **independiente de Angular / ibarra-app**. No modifica el módulo Peajes, Supabase ni el dashboard. Solo opera bajo `scripts/` para obtener archivos operativos desde Telepase.

## Fuente de verdad

| Artefacto | Ruta |
|---|---|
| Documentación de uso | [`telepase-downloader.md`](./telepase-downloader.md), [`carga-express-bot.md`](./carga-express-bot.md), [`carga-express-masiva-bot.md`](./carga-express-masiva-bot.md) |
| Estado de features | [`../feature-list-script.json`](../feature-list-script.json) |
| Código | `scripts/telepase/`, `scripts/carga-express-bot/` |
| HTML fuente | `scripts/html/facturas` |
| Salida | `scripts/downloads/{CONCESIONARIO}/` |
| Skill de agentes | `scripts/.agents/skills/telepase-scraper/SKILL.md` |
| Skills Playwright (referencia) | `ibarra-app/.agents/skills/playwright-cli/`, `playwright-best-practices/`, `scrape/` |

## Separación de dominios (obligatorio)

| Dominio | Propiedad | No tocar |
|---|---|---|
| **Telepase scripts** | `scripts/telepase/**`, `scripts/html/**`, `scripts/downloads/**`, `scripts/docs/*-script*`, `scripts/feature-list-script.json`, `scripts/.agents/**` | `ibarra-app/src/**`, migraciones, dashboard |
| **Angular / Peajes** | `ibarra-app/` | No debe depender de estos scripts en runtime |

Los CSV/PDF descargados pueden usarse **después** como input manual del wizard Peajes; no hay acoplamiento de código.

## Estado actual

Fecha: **2026-08-07** — XREF Peajes `TS-XREF-F13-2` en `feature-list-script.json`: el Excel sample `telepeaje plus/202607-2/ConsumosResumen.xlsx` (columna `FACTURA`) alimenta la importación masiva multi-empresa del wizard. Implementación canónica: `ibarra-app/feature_list.json` → **F13-2** + `ibarra-app/docs/claude-progress.md`. No hay cambios de código Angular bajo `scripts/`.

Fecha previa: **2026-08-05** — Pipeline MVP **operativo**.

- Parser DataTables: **157** filas con factura+pasada.
- Descarga completa: **314** archivos (157 PDF + 157 CSV), fallos residuales **0**.
- Dos pases: `--no-auth` (URLs por concesionario) + login autenticado (AUSA genérico).
- Docs de uso: `scripts/docs/telepase-downloader.md`.

### Decisiones vigentes

1. Login real: `https://telepase.com.ar/login` (`/admin/login` → 404).
2. URLs `descargar-factura-{slug}/…` y `descargar-pasadas-{slug}/…` suelen ser **públicas**.
3. URLs AUSA `descargar-factura/{numero}/DR/…` suelen **requerir sesión**.
4. Extensión por `Content-Type` / `Content-Disposition` (`text/plain` de pasadas → `.csv`).
5. Carpeta = `data-concesionario` ‖ slug URL ‖ clase `filtro-tr` (no el texto “AU. DEL MERCOSUR”).
6. Anchors sin `ga-descargar-*` (caso AUMESA) se detectan por `href*=descargar-factura|pasadas`.
7. Secretos solo en `scripts/telepase/.env` + `auth.json` (gitignored).
8. Re-runs: skip si existe `facturas|pasadas_{periodo}_{numero}.*`.

### Comandos canónicos

```powershell
cd scripts/telepase
npm install
npx playwright install chromium

node parse-facturas.mjs
node download-batch.mjs --no-auth          # pase público
node login.mjs --force
node download-batch.mjs                    # relleno autenticado
```

## Historial de sesiones

### 2026-09-10 — rows.json lock + fechaDescarga

- Batch aborted after GCO 24 because `writeFileSync(rows.json)` hit Windows `UNKNOWN` / errno -4094.
- `writeRowsJson` now writes atomically with retries; progress persist never aborts downloads.
- `status.csv` gained `fechaDescarga` (`YYYY-MM-DD HH:mm:ss` local), stamped only on SAVED files. Older rows stay blank.
- Re-parse keeps previous `downloadedAt` values.
- `download-batch.mjs` accepts `--month-init` / `--month-finish` (aliases `--month_init`, `--mont_finish`) to keep rows by `periodo` month. Example: `node download-batch.mjs --month-init 3 --month-finish 4`.
- Verification: `npm test` in `scripts/telepase`.

### 2026-09-02 — Generate status.csv from rows.json

- `download-batch.mjs` never wrote `scripts/downloads/status.csv`; the carga-express bot expected that file.
- Added `scripts/telepase/build-status-csv.mjs`: maps `rows.json` to the bot CSV, discovers local factura/pasada files, keeps previous Template/status on regenerate.
- Empresa/Template from DESARROLLO plantillas (`AUSA-V3`, `AUSOL-7-2026`, `AU-OESTE-V1-08-26`, `AUBASA-7-2026`; AUMESA template left blank for enrich).
- Verification: `node --test build-status-csv.test.mjs` 4 passed.

### 2026-08-25 - Download path metadata

- Added `fileFacturaPath` and `filePasadasPath` to `rows.json`.
- Paths are repository-relative and matched by concessionaire, period, and invoice number.
- Existing downloads are discovered by filename prefix, preserving the payload-derived extension.
- Focused verification: `node --test scripts/telepase/download-paths.test.mjs` passed (3 tests).

### 2026-08-05 — MVP scraper + full download

- Scaffold `scripts/telepase` (parse, login, download-batch, paths).
- Pilot AUMESA/SANTAFE/AUSA OK.
- Full `--no-auth`: 297 saved / 12 skipped / 5 failed (AUSA facturas → redirect dashboard).
- Auth retry: 5 PDF AUSA recuperados; total **314** archivos.
- Docs + feature list + skill creados bajo `scripts/`.

### 2026-08-25 — AUMESA invoice template enrichment

- Added `telepase/enrich-status-templates.mjs` using `pdf-parse` text extraction.
- Dry-run inspected 128 AUMESA rows and matched all 128 invoice PDFs.
- Applied `status.csv`: 31 ZARATE, 33 COLONIA, 32 YERAU, and 32 PIEDRITAS.
- `YERUA-CAT` is recognized as `MERCA-SUR-003-YERAU` and takes priority over locality ZARATE.
- Report: `scripts/downloads/status-template-report.json`.

### 2026-08-25 — Carga-express Selenium upload bot

- Added `scripts/carga-express-bot` (Node + selenium-webdriver, POM pages).
- Reads `scripts/downloads/status.csv`, uploads CSV+PDF to `/peajes/carga-express`.
- Writes `uploadFileStatus` / `messageStatus`; parks USER_INPUT tabs with Windows MessageBox.
- Docs: `scripts/docs/carga-express-bot.md`. Feature `TS04-1`.

### 2026-08-25 — Carga-express retry and provider failover

- Paso 7 now reports visible validation errors, Angular invalid controls, missing required fields, and a disabled Continuar button.
- Invalid Paso 7 rows receive one full restart from Paso 1; a second failure is marked `FAILED` and processing continues.
- Removed the two parked-tab limit; each `USER_INPUT` row keeps its own tab.
- Added in-memory consecutive provider failure tracking: after five failures, a provider is skipped when another provider is eligible, with fallback when it is the only provider left.
- Added provider and Paso 7 form-state tests; `npm test` passes 24 tests.
- Paso 8 validation blocks caused by invoice/pass differences now write `FAILED` and continue with the next row instead of creating `USER_INPUT`.
- Added validation-failure regression tests; `npm test` passes 26 tests.
- Restricted automatic row selection to `FAILED` and `USER_INPUT`; `COMPLETE`, blank, and `IN_PROGRESS` rows are skipped.
- Added status-filter regression coverage; `npm test` passes 27 tests.
- Added terminal `DUPLICATED` status for repeated passes; duplicate rows are not retried in later runs.
- Added a compact per-run console summary with missing files, errors, duplicates, manual rows, and outcomes.

### 2026-08-26 — `--local` precedence + cat-loader wait

- `--local` now always uses `http://localhost:4200` even if `.env` has `BASE_URL` pointing at production. The bot logs `URL: …` before Chrome starts and fails fast if ng serve is down.
- Paso 7 wait targets `app-ai-cat-loader` (not `app-graph-loader`). Logs `[AI] <numero> state=… chips=…`.
- `npm test` — 36 passed (`resolveBaseUrl` + cat-loader selector + recognition helper).
- Localhost smoke `--local --limit 1 --row 5009A02010049`: logged `URL: http://localhost:4200/peajes/carga-express` and `Login OK` on localhost. Invoice AI settled as `state=error chips=0` after 3 retries × 3 reloads (OpenRouter did not return suggestions). Loader wait did not time out.

### 2026-08-28 — Carga-express masiva bot (Telepeaje Plus)

- Added `node run-masiva.mjs` in `scripts/carga-express-bot`. Allowlist `MASIVA_FOLDERS` in `.env` (no full-tree scan). Uploads `Consumo_*_MAPPED.xlsx` + `Comprobantes/*.pdf` in **Importación masiva**, plantilla `MASIVOOO`.
- Status: `scripts/telepeaje plus/status-masiva.csv`. Paso 7 waits accordion badge `Sugerencias listas` (5–8 min for 1–10 PDFs). Error IA / timeout / invalid form → `USER_INPUT`, no refresh, no `FAILED`.
- Docs: `scripts/docs/carga-express-masiva-bot.md`. Feature `TS04-2`.

### 2026-08-28 — Masiva AI wait: idle queue, not PDF file count

- Wait no longer requires `ready === expectedPdfs`. Logs showed AI finished at ~208s with `ready=10 analyzing=0 loader=false expectedPdfs=11`; bot kept polling until timeout because one unmatched PDF never gets a pin.
- Proceed after ~10s idle (loader off, no Analizando, no Con PDF) when at least one ready/error pin exists. Badges counted by CSS (`paso7__acc-badge--ready` / pin) plus label.
- Suggestion chips live under accordion `*ngIf="isExpanded"`; bot expands all `.app-acc-panel__trigger` then clicks `.paso7__suggest` in `.paso7__masiva`.

### 2026-08-31 — Masiva chips per accordion panel + do not skip first folder

- Chips were only applied on `app-accordion-panel[1]` because that panel starts expanded; `[2]…[n]` stay behind `*ngIf="isExpanded"`. Bot now clicks each panel trigger by 1-based XPath and applies `.paso7__suggest` inside that panel.
- Soft AI timeout no longer starts the next folder while the queue is still `Analizando`. Wait continues until idle (hard cap `max(timeout×2, 20min)`). Parked Factura tabs block new folders until chips + Continuar succeed.

### 2026-08-31 — Paso 9 wait for Carga confirmada dialog

- Confirm used to return immediately because `.pw__status--valid` and the `app-dialog` host are already on the page («Listo para confirmar»). Upload can take ~1 min.
- Wait now targets the open dialog section (`app-paso9-revision/div/app-dialog/div/section`) or status «Carga confirmada», up to 90s (120s masiva). Dialog stays visible ~5s before **Cargar otro archivo**.

### 2026-08-31 — Masiva duplicates stay USER_INPUT

- Paso 8 duplicate detection no longer writes `DUPLICATED` and closes the tab. Parks `USER_INPUT`, keeps Chrome open, and resumes when Continuar is enabled or the user reaches Revisión (after «Subir igualmente»).

### 2026-08-31 — Resume stale IN_PROGRESS

- `202608-1` was `IN_PROGRESS` in `status-masiva.csv` from a previous kill. Masiva skipped it (not retryable), logged in, then quit. Stale `IN_PROGRESS` is retryable again; idle allowlist is logged instead of a silent exit.

## Bloqueos / riesgos

| Riesgo | Mitigación |
|---|---|
| Cloudflare / 429 | Delay 300–600 ms; reintentos ×3; re-run skip-existing |
| JWT corto (~15 min) | `node login.mjs --force` antes del pase auth |
| HTML facturas desactualizado | Re-guardar página Telepase en `scripts/html/facturas` |
| Credenciales en chat/snapshots | Nunca commitear `.env` / `auth.json` |

## Próximos pasos sugeridos (no iniciados)

- Automatizar refresco del HTML facturas vía Playwright (listado + filtros).
- Manifest JSON de descargas (hash, content-type, row metadata).
- Hook opcional: copiar CSV AUMESA/SANTAFE a `ibarra-app/docs/plan/csv/` solo bajo pedido.
