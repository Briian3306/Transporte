# F01 Schema — Catálogos, facturas/pasadas, plantillas y algoritmos

## Summary

Migraciones del dominio Peajes: catálogos (`peajes`, `estaciones`, `patentes`, `pases`), `facturas`/`pasadas` (con `estacion_id`, sin `peaje_id` directo), `plantillas_configuracion`/`configuraciones_plantilla`, `algoritmos_combinados`/`algoritmo_combinado_pasos` + catálogo de códigos. Alta condicional de `system_modules.name = peajes`.

## Workflow Context

- Testing: **Supabase CLI** (`http://127.0.0.1:54321`)
- Remoto DESARROLLO: `kfffigvyvtzyczeiadxh` — **no push en esta sesión** (requiere autorización explícita)
- Prohibido: refs OrdenCompra

## Affected Objects

- Tables: `peajes`, `estaciones`, `patentes`, `pases`, `facturas`, `pasadas`, `plantillas_configuracion`, `configuraciones_plantilla`, `peajes_algoritmos_catalogo`, `algoritmos_combinados`, `algoritmo_combinado_pasos`
- Views: `pasadas_con_peaje` (security_invoker)
- Policies/RLS: enabled + policy `*_authenticated_all` (MVP §5.2)
- Angular services: `PeajesCatalogoSupabaseService`, `PeajesPlantillasSupabaseService`

## Migration

```text
supabase/migrations/20260730125513_peajes_catalogos.sql
supabase/migrations/20260730125518_peajes_facturas_pasadas.sql
supabase/migrations/20260730125523_peajes_plantillas.sql
supabase/migrations/20260730125529_peajes_algoritmos.sql
```

## Execution Notes

1. Orden: catálogos → facturas/pasadas → plantillas → algoritmos (FK diferida de `configuraciones_plantilla.algoritmo_combinado_id`).
2. `system_modules`: insert solo si la tabla host existe (en `db reset` CLI vacío se omite con NOTICE).
3. No reutiliza `checklist_templates`.
4. `empresa_id` es **text** (no uuid) en peajes/facturas/plantillas/algoritmos para admitir el marcador global `'__global__'` (RN-23 / contrato Agente 03). Listados del servicio real incluyen empresa activa **o** `__global__`.

## Local Verification

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
```

Resultado 2026-07-30: reset OK; pgTAP `peajes_f01_test.sql` **29/29 PASS**.

## DESARROLLO

No ejecutado. Cuando el usuario autorice:

```powershell
Get-Content supabase\.temp\project-ref
# esperado: kfffigvyvtzyczeiadxh
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Nunca `db reset --linked`.
