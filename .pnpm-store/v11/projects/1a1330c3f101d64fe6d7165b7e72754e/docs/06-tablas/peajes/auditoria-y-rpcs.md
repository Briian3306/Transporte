# Auditoría de carga — Peajes

## Resumen

Tabla `registros_carga_peajes` (snapshot de carga confirmada, RF-26). El **catálogo completo de RPCs** vive en [docs/backend/functions/index.md](../../backend/functions/index.md); no se duplica aquí.

## Índice

- [Resumen](#resumen)
- [registros_carga_peajes](#registros_carga_peajes)
- [RPCs](#rpcs)
- [Referencias](#referencias)

---

## registros_carga_peajes

Campos relevantes:

- `documento_id` (ex `factura_id`), `plantilla_id` (nullable)
- `parametros_efectivos` (jsonb)
- `filas_procesadas`
- `errores` (jsonb, nullable)
- `created_at`

RLS: policy authenticated ALL (MVP §5.2).

Confirmación vía `peajes_confirmar_carga` → [confirmar-carga.md](../../backend/peajes/confirmar-carga.md).

---

## RPCs

Ver catálogo: [backend/functions](../../backend/functions/index.md).

Detalle por tema:

- Validación importes / documento
- Duplicados RN-16
- Gestión de pasadas
- Plantillas / algoritmos
- Aliases estaciones

---

## Referencias

- Migraciones: `supabase/migrations/*peajes*.sql`
- Tests: `supabase/tests/peajes_f01_test.sql`
- Servicio: `PeajesCargaSupabaseService`

---

> Última actualización: agosto 2026
