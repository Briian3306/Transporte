# F01 RPC — Validación, duplicados, plantillas, algoritmos y auditoría

## Summary

RPCs y tabla de auditoría para Peajes: cálculo/validación de importes y factura, detección de duplicados, sobrescritura transaccional de plantilla, validación/expansión de algoritmos combinados, confirmación de carga con registro auditado.

## Workflow Context

- Testing: **Supabase CLI**
- DESARROLLO: no push en esta sesión
- Tolerancia monetaria MVP: `0.01` (`peajes_tolerancia_importe()`)

## Affected Objects

- Tables: `registros_carga_peajes`
- RPC:
  - `peajes_calcular_importe_neto`
  - `peajes_validar_factura_pasadas` / `peajes_validar_factura_id`
  - `peajes_detectar_duplicados`
  - `peajes_sobrescribir_configuraciones_plantilla`
  - `peajes_validar_algoritmo_combinado` / `peajes_expandir_algoritmo` / `peajes_guardar_algoritmo_combinado`
  - `peajes_confirmar_carga`
- Angular: `PeajesCargaSupabaseService`, `PeajesPlantillasSupabaseService`

## Migration

```text
supabase/migrations/20260730125534_peajes_rpc_y_auditoria.sql
```

## SQL Commands (resumen)

```sql
-- Importe neto
SELECT peajes_calcular_importe_neto(100, 10); -- 90

-- Validar factura vs suma
SELECT peajes_validar_factura_pasadas(100, ARRAY[50,50]::numeric[], 0.01);

-- Duplicados
SELECT peajes_detectar_duplicados('[{"pase_id":"...","fecha_hora":"...","estacion_id":"...","patente_id":"..."}]'::jsonb);

-- Sobrescribir plantilla (TX)
SELECT peajes_sobrescribir_configuraciones_plantilla('<plantilla_id>', '[{"nombre_columna":"X","orden":1,"tipo":"mapeo"}]'::jsonb);

-- Validar algoritmo
SELECT peajes_validar_algoritmo_combinado('[{"orden":1,"algoritmo_codigo":"TRIM"}]'::jsonb);
```

## Local Verification

```powershell
npx supabase db reset --local --no-seed
npx supabase test db
```

Evidencia 2026-07-30: `All tests successful. Files=1, Tests=29. Result: PASS`.

## DESARROLLO

No autorizado / no ejecutado.
