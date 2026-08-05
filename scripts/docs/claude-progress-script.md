# Progreso de agentes — Telepase scraper (scripts)

Bitácora del **pipeline de extracción Telepase** (HTML → facturas PDF / pasadas CSV).

Este trabajo es **independiente de Angular / ibarra-app**. No modifica el módulo Peajes, Supabase ni el dashboard. Solo opera bajo `scripts/` para obtener archivos operativos desde Telepase.

## Fuente de verdad

| Artefacto | Ruta |
|---|---|
| Documentación de uso | [`telepase-downloader.md`](./telepase-downloader.md) |
| Estado de features | [`../feature-list-script.json`](../feature-list-script.json) |
| Código | `scripts/telepase/` |
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

Fecha: **2026-08-05** — Pipeline MVP **operativo**.

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

### 2026-08-05 — MVP scraper + full download

- Scaffold `scripts/telepase` (parse, login, download-batch, paths).
- Pilot AUMESA/SANTAFE/AUSA OK.
- Full `--no-auth`: 297 saved / 12 skipped / 5 failed (AUSA facturas → redirect dashboard).
- Auth retry: 5 PDF AUSA recuperados; total **314** archivos.
- Docs + feature list + skill creados bajo `scripts/`.

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
