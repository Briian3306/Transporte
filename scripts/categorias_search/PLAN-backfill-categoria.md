# PLAN — Backfill `pasadas.categoria` from original Telepase files

One-off recovery toolkit. **Does not** change Angular product code and **does not** run `UPDATE` against live `public.pasadas`.

## Goal

Recover provider toll category (`CATEGORIA` from Telepase CSVs) into a join file `update_categoria_pasadas.csv`, then test an SQL backfill only on table `pasadas_categoria_bak`.

Do **not** confuse:

| Field | Meaning |
|---|---|
| Source `CATEGORIA` / `pasadas.categoria` | Provider class (`5`, `6`, `7`, `9`…) — RN-15 raw text |
| `Patente_Categoria` (PWBI) | Fleet enum `TRANSPORTE\|REMIS\|AUTO\|OBRA` |

## Inputs

| Path | Role |
|---|---|
| `pasadas_rows.csv` | Export of `pasadas` (ids, `precio`, `file_upload_name`) |
| `pwbi_pasadas_rows.csv` | Same rows + patente text + peaje/empresa names |
| `../downloads/{CONCESION}/**/pasadas_*.csv` | Original files with `CATEGORIA` |
| `../telepeaje plus/**/ConsumosResumen*.xlsx` | No `CATEGORIA` (Patrón A) |

`../downloads/errors.csv` is a download-failure log only — not an inventory.

## Run (Node)

From this folder:

```bash
node 01_extract_db_keys.mjs
node 02_extract_source_categoria.mjs
node 03_join_update_categoria.mjs
# optional local bak test (Docker Supabase DB; never updates public.pasadas):
node 04_seed_and_test_bak.mjs
```

Outputs:

- `db_keys.csv`
- `source_categoria.csv`
- `update_categoria_pasadas.csv` — `id,file_name,patente,tarifa,categoria,concesion`
- `join_unmatched_db.csv`, `join_ambiguous.csv`

### Join result (2026-08-12)

| Metric | Value |
|---|---|
| DB rows | 3465 |
| Matched with `categoria` | **1750** |
| Unmatched ConsumosResumen | 1711 |
| Other unmatched | 4 |
| Ambiguous | 0 |
| Strategies | 967 full key + 783 file/patente/time fallback |

## SQL test (backup only)

See [APENDICE-B-update-sql-supabase.md](./APENDICE-B-update-sql-supabase.md).

Order: `sql/01` → `sql/02` → load CSV into staging → `sql/03` → `sql/04`. Never run `sql/99` in the agent session.

## Appendices

- [APENDICE-A-fuentes-y-columnas.md](./APENDICE-A-fuentes-y-columnas.md)
- [APENDICE-B-update-sql-supabase.md](./APENDICE-B-update-sql-supabase.md)
