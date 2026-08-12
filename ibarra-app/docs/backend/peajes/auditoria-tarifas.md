# Auditoría tarifaria (F14) — RPCs y tablas

## Summary

Normalización y auditoría de niveles de tarifa a partir de `pasadas` ya importadas. Tablas `tarifas_normalizadas`, `tarifas_parametros_peaje`, `tarifas_status_catalogo`; columnas `pasadas.categoria` / `tarifa_normalizada_id` / `tarifa_status`. El peaje se deriva por `estaciones.peaje_id` (RN-05); no hay `pasadas.peaje_id`.

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Business Logic](#business-logic)
- [Relations](#relations)
- [Tables](#tables)
- [Functions](#functions)
- [Validations](#validations)
- [Testing](#testing)
- [Notes](#notes)

## Purpose

Exponer el motor de diagnóstico (capa 1) y la confirmación humana de status (capa 2) para la pantalla `/peajes/auditoria-tarifas`.

## Business Logic

1. Tras `peajes_confirmar_carga`, el servicio Angular llama `peajes_normalizar_tarifas(documento_id)` en una TX aparte (opción b): fallo de normalización no revierte la carga.
2. `peajes_recalcular_tarifas(peaje_id)` recalcula toda la foto del peaje (solo FC, `precio > 0`); no pisa `diagnostico`/`status` si `confirmado_manual`.
3. Dispersión horaria con `AT TIME ZONE 'UTC'`; umbrales default 15 / 4.100 desde `tarifas_parametros_peaje` o COALESCE.
4. Status: universales `PENDIENTE`|`POSIBLE_HORARIO` o código de `tarifas_status_catalogo` del mismo peaje (trigger).

## Relations

| Consumidor | Operación |
|------------|-----------|
| `PeajesCargaSupabaseService.confirmarCarga` | post-commit → `peajes_normalizar_tarifas` |
| `PeajesAuditoriaTarifasSupabaseService` | listar / confirmar / marcar / grupos / recalcular / catálogo |
| Power BI `pwbi_pasadas` | columnas `Categoria`, `Tarifa_Normalizada_ID`, `Tarifa_Status` |

## Tables

| Tabla | Rol |
|-------|-----|
| `tarifas_parametros_peaje` | Umbrales por peaje |
| `tarifas_status_catalogo` | Vocabulario PICO/NO_PICO/… por peaje |
| `tarifas_normalizadas` | Nivel (peaje, estación, categoria, importe) + diagnóstico/status |
| `pasadas` (+3 cols) | `categoria` texto crudo (RN-15); FK opcional a nivel; `tarifa_status` desnormalizado |

## Functions

| Función | Firma | Retorno |
|---------|-------|---------|
| `peajes_normalizar_tarifas` | `(p_documento_id uuid)` | `(pasadas_matcheadas int, grupos_nuevos int)` |
| `peajes_recalcular_tarifas` | `(p_peaje_id uuid)` | `int` (pasadas actualizadas) |
| `peajes_confirmar_status_tarifa` | `(p_asignaciones jsonb)` | `{niveles_confirmados, pasadas_actualizadas}` |
| `peajes_marcar_diagnostico_tarifa` | `(id uuid, diagnostico text)` | jsonb; solo `CATEGORIA`\|`REVISAR` |
| `peajes_listar_tarifas_normalizadas` | `(filtros, page, page_size, sort)` | `{rows, total, page, page_size}`; `p_sort` = `campo:dir` |
| `peajes_grupos_similares_tarifa` | `(id uuid, tolerancia numeric)` | filas con `tarifa_ids[]` ordenados por importe |

Filtros de listado (jsonb): `peaje_id`, `peaje_ids[]`, `estacion_ids[]`, `categorias[]` (`__SIN_CATEGORIA__`), `status[]`, `diagnosticos[]`, `patron`, `muestra_confiable` / `solo_muestra_confiable`, `confirmado_manual`, `q_estacion`.

## Validations

- Trigger `trg_validar_status_tarifa` → ERRCODE `23514` si status inválido.
- `UNIQUE NULLS NOT DISTINCT (peaje_id, estacion_id, categoria, importe)`.
- NC: `peajes_normalizar_tarifas` retorna `(0,0)` sin error.

## Testing

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
# peajes_f14_test.sql (B-01..B-16 sintéticos) + regresiones F01/F06/pwbi
```

## Notes

- RLS plana `*_authenticated_all` (PRD §5.2); RLS por empresa diferida.
- `pg_cron` no instalado: recálculo solo manual.
- Migraciones: `20260812140628`…`20260812140653_peajes_tarifas_*`.
- Servicio: `src/app/components/peajes/services/peajes-auditoria-tarifas.service.ts`.
- Provider en `auditoria-tarifas.routes.ts` apunta al servicio Supabase (no mock).

---

> Última actualización: 2026-08-12
