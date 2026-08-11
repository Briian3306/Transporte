---
name: verification-pasadas-files
description: >-
  Read-only revision of peajes pasadas in DESARROLLO against source CSV/Excel
  (ConsumosResumen, Telepase exports). Compares fecha_hora and key fields,
  reports mismatches over a time threshold. Use when verifying production
  pasadas vs files, auditing wrong dates, reconciling Excel/CSV with
  pasadas/pasadas_gestion, or checking file_upload_name loads.
---

# Verification Pasadas ↔ Files

Safe, **read-only** revision workflow: source CSV/Excel vs pasadas on DESARROLLO.

## When to use

- User asks to verify / reconcile / audit pasadas against an Excel or CSV
- Suspected wrong `fecha_hora` (or other fields) after a wizard load
- Compare Telepase / ConsumosResumen files with production rows

## Safety rules (mandatory)

1. **Read-only.** No `UPDATE`/`DELETE` on pasadas, no `db push`, no `db reset --linked`, no repair of remote migration history.
2. Confirm linked project is DESARROLLO (`kfffigvyvtzyczeiadxh`) before any remote query.
3. Prefer Supabase MCP `execute_sql` or Angular-safe selects/RPCs that only **read**.
4. Do **not** commit dumps of production rows into the repo. Temp scripts/JSON under `.tmp-*` must be deleted after the run.
5. In chat, report **mismatches only** (or small samples). Do not paste full 600+ row dumps.
6. Forbidden OrdenCompra refs: `edxoqshrzdqpnldktpzy`, `uurlssweuhshbwpxxatw`.

## Environment

| Target | Role |
|--------|------|
| DESARROLLO `kfffigvyvtzyczeiadxh` | Source of truth for “production” pasadas in this project |
| Supabase CLI local | Optional sanity only; not a substitute for DESARROLLO file revision |

See [../backend-supabase-write/entornos.md](../backend-supabase-write/entornos.md).

## Domain facts

- Table `pasadas` has **`fecha_hora`** (`timestamptz`) only — **no** `fecha` column.
- Invoice date lives on **`documentos.fecha_factura`** (join via `documento_id`).
- UI must display `fecha_hora` as **UTC wall-clock** (`formatUtcDateTime` in `peajes-fecha.util.ts`), not browser local TZ.
- ConsumosResumen Excel columns (typical): `Dominio` → patente, `Tag Nº` → pase, `FACTURA`, `Estación`, `Fecha` (Excel serial), `Importe Final`.
- Filter loaded batches with `file_upload_name` (e.g. `ConsumosResumen-202607-1.xlsx`).

## Workflow checklist

Copy and track:

```text
Revision Progress:
- [ ] 1. Identify source file path + expected file_upload_name
- [ ] 2. Confirm DESARROLLO project ref
- [ ] 3. Count DB rows for that file_upload_name
- [ ] 4. Parse Excel/CSV Fecha → UTC wall-clock
- [ ] 5. Match rows (patente + pase + factura; fallback patente + pase)
- [ ] 6. Diff fecha_hora; keep only |Δ| > threshold (default 4 minutes)
- [ ] 7. Report mismatches + summary; delete temp artifacts
```

### 1. Inputs

Ask if missing:

- Path to `.xlsx` / `.csv` (often under `scripts/telepeaje plus/…`)
- `file_upload_name` stored on pasadas
- Threshold minutes (default **4**; do not report ≤ threshold)
- Extra fields to check (optional): precio / estación / documento

### 2. Load DB (read-only)

```sql
SELECT pt.patente, pa.pase, d.factura AS documento, d.fecha_factura,
       p.fecha_hora, (p.fecha_hora AT TIME ZONE 'UTC')::text AS fecha_hora_utc,
       e.nombre AS estacion, p.precio
FROM pasadas p
JOIN patentes pt ON pt.id = p.patente_id
JOIN pases pa ON pa.id = p.pase_id
JOIN documentos d ON d.id = p.documento_id
JOIN estaciones e ON e.id = p.estacion_id
WHERE p.file_upload_name = '<FILE_UPLOAD_NAME>'
ORDER BY p.fecha_hora;
```

Or paginate `peajes_listar_pasadas` with `q_archivo`.

### 3. Parse file Fecha

- Excel serial → UTC wall-clock ms: `Math.round((serial - 25569) * 86400 * 1000)` then format with **UTC** getters.
- CSV text → normalize with `toPostgresFechaHora` / same wall-clock string `yyyy-MM-dd HH:mm:ss`.
- Do **not** use browser-local `Date#getHours()` for comparison.

### 4. Match keys

1. Primary: `patente` + `pase` + `FACTURA`/`documento`
2. Fallback: `patente` + `pase`, pick closest `fecha_hora`
3. Greedy 1:1 (each DB row used once)

### 5. Diff rules

- Compare Excel wall-clock vs `fecha_hora` **UTC components** (same instant string Supabase shows with `+00`).
- Report only if absolute difference **> 4 minutes** (or user threshold).
- Parsing pitfall: never use `/[+-]\d{2}/` on the whole timestamp string — it matches `-26` inside `2026-06-26`. Prefer:

```js
const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(s);
Date.parse(`${m[1]}T${m[2]}Z`);
```

### 6. Report format

```markdown
## Pasadas file revision

- File: `<path>`
- file_upload_name: `<name>`
- Excel/CSV rows: N · DB rows: M · Matched: K · Unmatched file rows: U
- Threshold: > 4 minutes
- Mismatches: X

| Patente | Datetime (file) | fecha_hora (DB) | fecha_factura (DB) | Δ minutes |
|---------|-----------------|-----------------|--------------------|-----------|
| … | … | … | … | … |
```

If X = 0, state clearly: no mismatches above threshold.

Optional field checks (only if asked): list precio/estación mismatches separately.

## UI cross-check

If the user also questions the **UI** Fecha column:

- Bug pattern: Angular `date` pipe shifts UTC → local (ART −3h).
- Correct display: `formatUtcDateTime` in pasadas list and pasadas-pendientes.
- Verification of **data** uses DB/Excel UTC wall-clock, not the broken local pipe.

## Out of scope

- Fixing or rewriting production `fecha_hora` (needs explicit write authorization + separate change)
- Wizard re-import / deleting loads
- Migration repair / `db push`

## Related

- Fecha helpers: `src/app/components/peajes/wizard/services/peajes-fecha.util.ts`
- List RPC: `peajes_listar_pasadas`
- Backend env: [../backend-supabase-write/entornos.md](../backend-supabase-write/entornos.md)
- Detail notes: [reference.md](reference.md)
