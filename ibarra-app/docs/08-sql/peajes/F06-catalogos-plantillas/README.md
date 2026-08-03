# F06 — Catálogos y plantillas de proveedores

## Resumen

La migración incorpora las semillas reproducibles para los dos archivos de prueba de Peajes. Amplía `estaciones` con ubicación geográfica y camino, admite cuatro categorías de patente, y deja activas las plantillas de **ACCESO OESTE** y **PROVEEDOR DEMO**.

## Objetos afectados

- `patentes`, `pases`, `peajes`, `estaciones`, `empresas`
- `plantillas_configuracion`, `configuraciones_plantilla`
- `algoritmos_combinados`, `algoritmo_combinado_pasos`

## Migración y datos fuente

`supabase/migrations/20260803170620_peajes_acceso_oeste_demo_catalogos_plantillas.sql`

- `docs/plan/seed/PASE,PATENTE Y CATEGORIA.xlsx`: 160 asociaciones pase/patente.
- `docs/plan/seed/ESTACIONES.xlsx`: 148 estaciones.
- `docs/plan/csv/387882.csv`: 39 aliases `ESTACION - VIA` de Acceso Oeste.
- `docs/plan/csv/1947768.xlsx`: contrato de la plantilla Demo.

La migración contiene los valores de las planillas, por lo que no depende de que el servidor de Supabase pueda acceder a esos archivos locales.

## Verificación local

```powershell
npx.cmd supabase migration up --local
npx.cmd supabase test db
```

Si la migración F06 aún no estaba aplicada, `migration up --local` la aplica. Alternativa completa: `npx.cmd supabase db reset --local --no-seed`.

El pgTAP asociado es `supabase/tests/peajes_f06_catalogos_plantillas_test.sql`. La validación local es obligatoria; no aplicar `db reset --linked` ni cambios remotos como parte de esta tarea.

### Nota SQL (UPDATE estaciones)

El `UPDATE ... FROM` de aliases de Acceso Oeste usa `FROM agrupadas a, public.peajes p WHERE p.id = e.peaje_id` (no `JOIN ... ON p.id = e.peaje_id` en el FROM), porque Postgres no permite referenciar la tabla destino del `UPDATE` en el `ON` del `FROM`.
