---
name: telepase-scraper
description: >-
  Standalone Telepase factura/pasada downloader under scripts/ (not Angular).
  Use when parsing scripts/html/facturas, logging into telepase.com.ar, downloading
  PDF/CSV via Playwright or public fetch, or extending the scripts/telepase pipeline.
  Combines playwright-cli, playwright-best-practices (auth/storageState/downloads),
  and professional scraping hygiene. Never couples runtime to ibarra-app.
---

# Telepase Scraper — Scripts-only extraction

## Purpose

Obtain **operational Telepase files** (factura PDF + pasadas CSV) from a saved admin HTML table, for later offline use (e.g. manual Peajes wizard input).

**This is not part of the Angular app.** Do not import these modules into `ibarra-app`, do not add Supabase calls here, and do not change Peajes UI for this feature.

## Sources of truth

| Artifact | Path |
|---|---|
| How to run | [`scripts/docs/telepase-downloader.md`](../../../docs/telepase-downloader.md) |
| Progress log | [`scripts/docs/claude-progress-script.md`](../../../docs/claude-progress-script.md) |
| Feature status | [`scripts/feature-list-script.json`](../../../feature-list-script.json) |
| Code | `scripts/telepase/` |

## Related skills (read when needed)

| Need | Skill |
|---|---|
| Browser CLI login / snapshot / `state-save` | [`playwright-cli`](../../../../ibarra-app/.agents/skills/playwright-cli/SKILL.md) |
| `storageState`, auth reuse, download events | [`playwright-best-practices`](../../../../ibarra-app/.agents/skills/playwright-best-practices/SKILL.md) → `advanced/authentication.md`, `testing-patterns/file-upload-download.md` |
| Generic scrape CLI patterns (Bright Data) | [`scrape`](../../../../ibarra-app/.agents/skills/scrape/SKILL.md) — optional; Telepase primary path is local Playwright/fetch |

## Hard boundaries

```text
ALLOWED
  scripts/telepase/**
  scripts/html/**
  scripts/downloads/**
  scripts/docs/telepase-downloader.md
  scripts/docs/claude-progress-script.md
  scripts/feature-list-script.json
  scripts/.agents/**

FORBIDDEN (unless user explicitly asks to integrate)
  ibarra-app/src/**
  ibarra-app/supabase/**
  ibarra-app/feature_list.json
  ibarra-app/docs/claude-progress.md
```

## Workflow (agents)

1. Read this skill + `telepase-downloader.md` + active feature in `feature-list-script.json`.
2. Confirm working directory is repo root or `scripts/telepase`.
3. Mark only the assigned `TS*` feature `in_progress`.
4. Prefer smallest change that satisfies verification.
5. Record evidence in `feature-list-script.json` and a short session note in `claude-progress-script.md`.
6. Never commit `.env`, `auth.json`, or `downloads/**` binaries.

## Canonical pipeline

```text
scripts/html/facturas
        │
        ▼
 parse-facturas.mjs ──► rows.json
        │
        ├─► download-batch.mjs --no-auth     (public operator URLs)
        │         │
        │         ▼
        │   scripts/downloads/{CONCESIONARIO}/
        │
        └─► login.mjs [--force] + download-batch.mjs
                  │
                  ▼
            fill AUSA / session-gated URLs
```

### Commands

```powershell
cd scripts/telepase
npm install
npx playwright install chromium

node parse-facturas.mjs
node download-batch.mjs --no-auth --limit 3 --diverse   # pilot
node download-batch.mjs --no-auth                         # full public
node login.mjs --force
node download-batch.mjs                                   # auth backfill
```

## Professional scraping rules (Telepase)

1. **Parse offline first** — Prefer saved HTML (`scripts/html/facturas`) over live DOM scraping for the table.
2. **Two-pass downloads** — Public `fetch` first; authenticated Playwright only for gated URLs.
3. **Honor robots of courtesy** — 300–600 ms jitter; max 3 retries with backoff; stop on systemic 429 storms.
4. **Never invent URLs** — Always use absolute `href` from the table.
5. **Detect real payloads** — Reject HTML login/dashboard bodies; accept `%PDF` and CSV headers (`FECHA;…`).
6. **Idempotent writes** — Skip existing `{facturas|pasadas}_{periodo}_{numero}.*`.
7. **Secrets** — Env vars only; `auth.json` via `storageState`; gitignore both.
8. **Login URL** — `https://telepase.com.ar/login` (not `/admin/login`).

## Playwright patterns to use

### Auth + storageState

```js
// login.mjs pattern (see scripts/telepase/login.mjs)
await page.goto('https://telepase.com.ar/login');
await page.getByRole('textbox', { name: /email/i }).fill(user);
await page.getByRole('textbox', { name: /contraseña|password/i }).fill(pass);
await page.getByRole('button', { name: /ingresar/i }).click();
await context.storageState({ path: 'auth.json' });
```

Optional CLI:

```bash
npx @playwright/cli open https://telepase.com.ar/login
# fill →
npx @playwright/cli state-save scripts/telepase/auth.json
```

### Authenticated GET (gated files)

```js
const context = await browser.newContext({
  storageState: 'auth.json',
  acceptDownloads: true,
});
const response = await context.request.get(facturaUrl, { maxRedirects: 5 });
const body = await response.body();
```

### Public GET (operator-specific URLs)

```js
const res = await fetch(url, { redirect: 'follow' });
const body = Buffer.from(await res.arrayBuffer());
```

## Parser rules (must keep)

| Field | Source |
|---|---|
| periodo / emisión | col 0 |
| vencimiento | first date in col 3 |
| numero | col 2 |
| monto | first `$…` in col 4 |
| facturaUrl | `a[href*="descargar-factura"]` in col 5 |
| pasadaUrl | `a[href*="descargar-pasadas"]` in col 6 |
| concesionario | `data-concesionario` → URL slug (`vsfe`→`SANTAFE`) → `tr` class → visible text |
| estado | first `span` in col 7 |

## Definition of done (feature)

A `TS*` feature is `passing` only when:

1. Behavior implemented under `scripts/`.
2. Verifications in `feature-list-script.json` pass.
3. Evidence recorded there + note in `claude-progress-script.md`.
4. Docs updated if CLI/flags/paths changed.
5. No product Angular files modified.

## Anti-patterns

| Don't | Do |
|---|---|
| Put scraper inside Angular services | Keep under `scripts/telepase` |
| Hardcode `.pdf`/`.csv` | Use response headers + magic bytes |
| Click every download in the UI for bulk | `fetch` / `context.request.get` |
| Commit credentials or PDFs | gitignore `.env`, `auth.json`, `downloads/*` |
| Update `ibarra-app/feature_list.json` for this work | Use `scripts/feature-list-script.json` |
