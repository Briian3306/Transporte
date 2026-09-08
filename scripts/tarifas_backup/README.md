# tarifas_backup — snapshot local de tarifas y pasadas

Toolkit de snapshot. **No** es una migración y **no** actualiza `public.pasadas` ni `public.tarifas_normalizadas`.

## Fuente

DESARROLLO (`kfffigvyvtzyczeiadxh`) vía MCP `execute_sql` (paginación por `id`). `supabase db dump --linked` no sirve (403).

Docker local (`supabase_db_ibarra-app`) es **otro** dataset; solo se usa para cargar tablas `*_bak` con los CSV.

## Archivos

| Path | Rol |
|---|---|
| `sql/01_export_copy.sql` | `COPY` opcional desde la DB a la que estés conectado (Docker/`psql`) |
| `sql/02_create_bak.sql` | Crea `pasadas_tarifas_bak`, `tarifas_normalizadas_bak`, `tarifas_status_catalogo_bak` |
| `sql/03_load_bak.sql` | Carga CSV → bak (nunca live) |
| `sql/04_verify.sql` | Conteos live vs bak |
| `sql/05_drop_bak.sql` | DROP de bak |
| `export-via-mcp.mjs` | SQL de columnas explícitas usado en el dump MCP |
| `extract-mcp-sql-json.mjs` | Extrae el array JSON de un resultado MCP a `data/pages/` |
| `json-pages-to-csv.mjs` | Junta páginas JSON del export MCP en un CSV |
| `data/*.csv` | Snapshot (gitignored) |
| `data/manifest.json` | Fecha, project id, conteos |

Tablas dumpadas (columnas explícitas, sin `SELECT *`):

- `tarifas_normalizadas`
- `pasadas`
- `tarifas_status_catalogo`

No se dumpan catálogos padre (`peajes`, `estaciones`, `documentos`, …). El snapshot sirve para comparar o restaurar a bak, no para recrear un entorno vacío.

Snapshot DESARROLLO 2026-08-31: `pasadas` 41071, `tarifas_normalizadas` 1080, `tarifas_status_catalogo` 44 (CSV = `count(*)`; 2 pasadas sin `tarifa_normalizada_id`). Ver `data/manifest.json`.

## Cargar bak en Docker local

Desde `scripts/tarifas_backup/`:

```bash
docker cp data/tarifas_normalizadas.csv supabase_db_ibarra-app:/tmp/tarifas_backup_tarifas_normalizadas.csv
docker cp data/pasadas.csv supabase_db_ibarra-app:/tmp/tarifas_backup_pasadas.csv
docker cp data/tarifas_status_catalogo.csv supabase_db_ibarra-app:/tmp/tarifas_backup_tarifas_status_catalogo.csv
docker cp sql/02_create_bak.sql supabase_db_ibarra-app:/tmp/02_create_bak.sql
docker cp sql/03_load_bak.sql supabase_db_ibarra-app:/tmp/03_load_bak.sql
docker cp sql/04_verify.sql supabase_db_ibarra-app:/tmp/04_verify.sql
docker exec -i supabase_db_ibarra-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/02_create_bak.sql
docker exec -i supabase_db_ibarra-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/03_load_bak.sql
docker exec -i supabase_db_ibarra-app psql -U postgres -d postgres -f /tmp/04_verify.sql
```

No corras estos SQL contra DESARROLLO salvo pedido explícito.
