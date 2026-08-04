# Módulo Peajes

## Resumen

Peajes automatiza la carga de archivos Excel/CSV, su reconocimiento, transformación, mapeo, relación con catálogos, validación de factura y persistencia/auditoría en Supabase. Es un dominio aislado de Checklists.

## Flujo implementado

`/peajes` → `/wizard` (9 pasos) → `/catalogos` → `/plantillas` → `/pasadas`.

El wizard conserva estado, muestra preview de hasta 10 filas, recomienda columnas y transformaciones, permite pipeline editable, resuelve estaciones con confirmación y patentes faltantes, valida factura/duplicados y confirma la carga. Los servicios reales encapsulan Supabase.

## Estructura

- `src/app/components/peajes/wizard`: carga y flujo de importación.
- `catalogos`: empresas, peajes, estaciones, patentes y pases.
- `plantillas`: Builder/Strategy, algoritmos combinados y motor.
- `services`: carga, catálogos, pasadas y plantillas contra Supabase.
- `supabase/migrations`: esquema, RPC, auditoría y seeds.
- `docs/06-components/peajes` y `docs/06-tablas/peajes`: documentación hija.

## Estado

Según `feature_list.json` (2026-08-04): 43 `passing`, 5 `in_progress` (F06-1/2/3, F07-1, F08-1) y 1 `not_started` (F06-5). El MVP F00–F05 está integrado y verificado; la ampliación Acceso Oeste/AUSOL y la gestión completa de pasadas aún requieren evidencia final.

## Riesgos actuales

- F06-5 no tiene evidencia E2E local de 496 pasadas, aliases y segunda ejecución idempotente.
- F07 requiere cerrar seed, reconocimiento y pruebas CLI; hay conteos de seed que todavía no coinciden.
- F08 tiene UI y migración en curso; debe completar pruebas de auditoría, paginación y CRUD.
- `init.sh` no corre en este host Windows sin Bash/WSL.

## Referencias

- [PRD](../plan/peaje-prd-es.md)
- [Componentes](../06-components/peajes/INDEX.md)
- [Tablas](../06-tablas/peajes/INDEX.md)
- [Features](../../feature_list.json)
- [Progreso](../claude-progress.md)
- [Handoff](../session-handoff.md)
