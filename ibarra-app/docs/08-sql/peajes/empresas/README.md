# Empresas — catálogo PRD §14

## Summary

Alta de la tabla `empresas` (`nombre`, `descripcion`) como catálogo de empresas/proveedores. Relación lógica con `peajes`, `facturas`, `plantillas_configuracion` y `algoritmos_combinados` vía `empresa_id` (text). No se convierte a FK uuid para preservar el marcador RN-23 `'__global__'`.

## Workflow Context

- Testing: **Supabase CLI** (`http://127.0.0.1:54321`)
- Remoto DESARROLLO: `kfffigvyvtzyczeiadxh` — push solo con autorización explícita
- Prohibido: refs OrdenCompra

## Affected Objects

- Tables: `empresas` (nueva)
- Columns (comentarios): `peajes.empresa_id`, `facturas.empresa_id`, `plantillas_configuracion.empresa_id`, `algoritmos_combinados.empresa_id`
- Policies/RLS: `empresas_authenticated_all`
- Angular services: ninguno en este cambio

## Migration

```text
supabase/migrations/20260731124502_peajes_empresas.sql
```

## SQL Commands

```sql
CREATE TABLE IF NOT EXISTS public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empresas_nombre_uk UNIQUE (nombre)
);

CREATE INDEX IF NOT EXISTS idx_empresas_nombre ON public.empresas (nombre);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresas_authenticated_all ON public.empresas;
CREATE POLICY empresas_authenticated_all ON public.empresas
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
```

## Execution Notes

1. Tabla plural `empresas` (convención del dominio: `peajes`, `estaciones`, …).
2. `empresa_id` en tablas hijas sigue siendo **text**: valor = `empresas.id::text` o `'__global__'`.
3. No se hace `db reset --linked` ni push a DESARROLLO sin autorización.

## Local Verification

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
```

Resultado 2026-07-31: reset OK; pgTAP `peajes_f01_test.sql` **34/34 PASS**.

## DESARROLLO

No ejecutado hasta autorización explícita:

```powershell
Get-Content supabase\.temp\project-ref
# esperado: kfffigvyvtzyczeiadxh
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Nunca `db reset --linked`.
