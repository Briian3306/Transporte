# Auditoría y RPCs — Peajes

## Resumen

Tabla de auditoría de cargas y funciones RPC (F01-5…F01-9). Migración `20260730125534_peajes_rpc_y_auditoria.sql`.

## Índice

- [Resumen](#resumen)
- [registros_carga_peajes](#registros_carga_peajes)
- [Catálogo de RPCs](#catálogo-de-rpcs)
- [Flujo de confirmación](#flujo-de-confirmación)
- [Verificación](#verificación)
- [Referencias](#referencias)

---

## registros_carga_peajes

Snapshot de una carga confirmada (RF-26).

Campos relevantes (implementados):

- `factura_id`, `plantilla_id` (nullable)
- `parametros_efectivos` (jsonb) — mapeos, relaciones estación, etc.
- `filas_procesadas`
- `errores` (jsonb, nullable)
- `created_at`

RLS: policy authenticated ALL (MVP §5.2).

---

## Catálogo de RPCs

| RPC | Feature | Propósito |
|-----|---------|-----------|
| `peajes_tolerancia_importe()` | — | Constante `0.01` |
| `peajes_calcular_importe_neto(precio, bonificacion)` | F01-5 | `precio - bonificacion` |
| `peajes_validar_factura_pasadas(importe, importes[], tolerancia?)` | F01-5 | Compara suma vs factura |
| `peajes_validar_factura_id(factura_id, tolerancia?)` | F01-5 | Variante por id |
| `peajes_detectar_duplicados(pasadas jsonb)` | F01-6 | Clave PASE+FECHA_HORA+ESTACION+PATENTE |
| `peajes_sobrescribir_configuraciones_plantilla(plantilla_id, configs jsonb)` | F01-7 | Replace transaccional |
| `peajes_validar_algoritmo_combinado(pasos jsonb)` | F01-8 | Códigos en catálogo + orden |
| `peajes_expandir_algoritmo(algoritmo_id)` | F01-8 | Lista pasos ordenados |
| `peajes_guardar_algoritmo_combinado(algoritmo jsonb, pasos jsonb)` | F01-8 | Persistencia + validación |
| `peajes_confirmar_carga(...)` | F01-9 | Inserta factura, pasadas y registro |

Schema auxiliar: `peajes_private` (uso interno de migraciones).

---

## Flujo de confirmación

`peajes_confirmar_carga` (resumen):

1. Detecta duplicados.
2. Calcula/valida importes netos por fila.
3. Valida suma vs importe de factura (tolerancia).
4. Persiste factura + pasadas + fila en `registros_carga_peajes`.

Consumido por `PeajesCargaSupabaseService.confirmarCarga`.

---

## Verificación

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
# Evidencia Agente 01: PASS 30/30 — peajes_f01_test.sql
```

DESARROLLO (`kfffigvyvtzyczeiadxh`): **sin push** hasta autorización explícita. Nunca `db reset --linked`.

---

## Referencias

- Fuente: `supabase/migrations/*peajes*.sql` y servicios Supabase.
- Servicio: `src/app/components/peajes/services/peajes-carga.service.ts`
- Tests: `supabase/tests/peajes_f01_test.sql`

---

> Última actualización: julio 2026
