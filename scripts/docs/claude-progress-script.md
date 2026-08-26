# Progreso de agentes — Telepase scraper (scripts)

Bitácora del **pipeline de extracción Telepase** (HTML → facturas PDF / pasadas CSV).

Este trabajo es **independiente de Angular / ibarra-app**. No modifica el módulo Peajes, Supabase ni el dashboard. Solo opera bajo `scripts/` para obtener archivos operativos desde Telepase.

## Fuente de verdad

| Artefacto | Ruta |
|---|---|
| Documentación de uso | [`telepase-downloader.md`](./telepase-downloader.md), [`carga-express-bot.md`](./carga-express-bot.md) |
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
