# F08 — Fix recreación `pasadas_con_peaje`

## Summary

Corrige la migración pendiente `20260803190348_peajes_pasadas_audit_gestion.sql`: PostgreSQL no permite `CREATE OR REPLACE VIEW` cuando `p.*` cambia el orden/nombres de columnas (error 42P16: `cannot change name of view column "peaje_id" to "user_id"`). Se usa `DROP VIEW` + `CREATE VIEW` preservando el contrato público.

## Workflow Context

- Canonical: Supabase CLI (local) = testing; DESARROLLO = remoto (no tocado).
- Project DESARROLLO: `kfffigvyvtzyczeiadxh` (solo referencia; no push).

## Affected Objects

- Views: `pasadas_con_peaje` (drop + create), `pasadas_gestion` (create or replace — vista nueva)
- Tables (ALTER only): `pasadas`, `registros_carga_peajes`
- Functions: `peajes_confirmar_carga`, `peajes_listar_pasadas`, CRUD pasadas

## Migration

```text
supabase/migrations/20260803190348_peajes_pasadas_audit_gestion.sql
```

## SQL Commands (fix relevante)

```sql
DROP VIEW IF EXISTS public.pasadas_con_peaje;
CREATE VIEW public.pasadas_con_peaje
WITH (security_invoker = true)
AS
SELECT
  p.*,
  e.peaje_id,
  e.nombre AS estacion_nombre,
  pj.nombre AS peaje_nombre
FROM public.pasadas p
JOIN public.estaciones e ON e.id = p.estacion_id
JOIN public.peajes pj ON pj.id = e.peaje_id;
```

## Execution Notes

1. No modificar migraciones ya aplicadas (`20260803183951`, `20260803190215` vacía).
2. `pasadas_gestion` / `peajes_listar_pasadas` no dependen de `pasadas_con_peaje`; el DROP es seguro sin CASCADE.
3. Contrato de `pasadas_con_peaje`: columnas de `pasadas` + `peaje_id` + `estacion_nombre` + `peaje_nombre`.

## Local Verification

```powershell
cd ibarra-app
git diff --check
npx supabase migration up --local
npx supabase test db
```

## DESARROLLO

No aplicar en este cambio. Requiere autorización explícita del usuario.
