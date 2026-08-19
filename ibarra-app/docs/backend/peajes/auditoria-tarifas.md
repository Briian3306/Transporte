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

Exponer el motor de diagnóstico (capa 1), la confirmación humana de status (capa 2) y la clase opcional `categoria_calculated` (capa 3, Patrón A) para la pantalla `/peajes/auditoria-tarifas`.

## Business Logic

1. Tras `peajes_confirmar_carga`, el servicio Angular llama `peajes_normalizar_tarifas(documento_id)` en una TX aparte (opción b): fallo de normalización no revierte la carga.
2. `peajes_recalcular_tarifas(peaje_id)` recalcula toda la foto del peaje (solo FC, `precio > 0`); no pisa `diagnostico`/`status` si `confirmado_manual`. **Borra** niveles de ese peaje que ya no tienen pasadas FC (fantasmas `MUESTRA_INSUFICIENTE` tras mover estación: p. ej. AUBASA DOCK SUD cat `7` importe `23536.62` cuando las pasadas pasaron a Zarate). FK `pasadas.tarifa_normalizada_id` es `ON DELETE SET NULL`.
3. Dispersión horaria con `AT TIME ZONE 'UTC'`; umbrales default 15 / 4.100 desde `tarifas_parametros_peaje` o COALESCE.
4. Status: universales `PENDIENTE`|`POSIBLE_HORARIO` o código de `tarifas_status_catalogo` del mismo peaje (trigger). Cada peaje nuevo recibe PICO/NO_PICO por `trg_peajes_seed_status_catalogo`; peajes existentes se rellenan en `20260818125312`. Sin catálogo, la UI solo ofrece universales y confirmar `PICO`/`NO_PICO` levanta `23514`.
5. `categoria_calculated` (smallint 0–10, NULL = sin asignar): clase vehicular que el analista anota en Patrón A. Opcional en `peajes_confirmar_status_tarifa`. Si el JSON no trae la clave, se conserva el valor. Recálculo / normalizar no la pisan. No es `pasadas.categoria` (RN-15).

## Relations

| Consumidor | Operación |
|------------|-----------|
| `PeajesCargaSupabaseService.confirmarCarga` | post-commit → `peajes_normalizar_tarifas` |
| `PeajesAuditoriaTarifasSupabaseService` | listar / confirmar / marcar / grupos / recalcular / catálogo |
| Power BI `pwbi_pasadas` | `Categoria`, `Categoria_Calculated`, `Categoria_Calculated_Boolean`, `Tarifa_Normalizada_ID`, `Tarifa_Status`, `Estacion_Geocodificacion_Status` |
| Power BI `pwbi_tarifas` | dimensión `tarifas_normalizadas`; relación `Tarifa_Normalizada_ID` |

## Tables

| Tabla | Rol |
|-------|-----|
| `tarifas_parametros_peaje` | Umbrales por peaje |
| `tarifas_status_catalogo` | Vocabulario PICO/NO_PICO/… por peaje. Semilla default al crear el peaje. |
| `tarifas_normalizadas` | Nivel (peaje, estación, categoria, importe) + diagnóstico/status + `categoria_calculated` opcional |
| `pasadas` (+3 cols) | `categoria` texto crudo (RN-15); FK opcional a nivel; `tarifa_status` desnormalizado |

## Functions

| Función | Firma | Retorno |
|---------|-------|---------|
| `peajes_normalizar_tarifas` | `(p_documento_id uuid)` | `(pasadas_matcheadas int, grupos_nuevos int)` |
| `peajes_recalcular_tarifas` | `(p_peaje_id uuid)` | `int` (pasadas actualizadas) |
| `peajes_confirmar_status_tarifa` | `(p_asignaciones jsonb)` | `{niveles_confirmados, pasadas_actualizadas}`. Cada ítem: `tarifa_normalizada_id`, `status_codigo`, `categoria_calculated?` (0–10, opcional) |
| `peajes_marcar_diagnostico_tarifa` | `(id uuid, diagnostico text)` | jsonb; solo `CATEGORIA`\|`REVISAR` |
| `peajes_listar_tarifas_normalizadas` | `(filtros, page, page_size, sort)` | `{rows, total, page, page_size}`; `p_sort` = `campo:dir` |
| `peajes_grupos_similares_tarifa` | `(id uuid, tolerancia numeric)` | filas con `tarifa_ids[]` ordenados por importe |
| `peajes_seed_status_catalogo_default` | `(p_peaje_id uuid)` | void; inserta PICO/NO_PICO si faltan (`ON CONFLICT DO NOTHING`) |

Filtros de listado (jsonb): `peaje_id`, `peaje_ids[]`, `estacion_ids[]`, `categorias[]` (`__SIN_CATEGORIA__`), `status[]`, `diagnosticos[]`, `patron`, `muestra_confiable` / `solo_muestra_confiable`, `confirmado_manual`, `q_estacion`.

## Validations

- Trigger `trg_validar_status_tarifa` → ERRCODE `23514` si status inválido.
- Trigger `trg_peajes_seed_status_catalogo` → `AFTER INSERT` en `peajes` siembra PICO/NO_PICO.
- `UNIQUE NULLS NOT DISTINCT (peaje_id, estacion_id, categoria, importe)`.
- `categoria_calculated` CHECK 0–10 o NULL (`23514` si 11 / −1).
- NC: `peajes_normalizar_tarifas` retorna `(0,0)` sin error.

## Testing

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
# peajes_f14_test.sql (B-01..B-16 + prune huérfanos + F14-9 categoria_calculated) + peajes_mercosur_patron_a_test.sql + peajes_tarifas_status_catalogo_default_test.sql + regresiones F01/F06/pwbi
```

## Notes

- RLS plana `*_authenticated_all` (PRD §5.2); RLS por empresa diferida.
- `pg_cron` no instalado: recálculo solo manual.
- Migraciones: `20260812140628`…`20260812140653_peajes_tarifas_*` + `20260814190600_peajes_recalcular_prune_orphans` + `20260814204300_peajes_tarifas_categoria_calculated` + `20260818125312_peajes_tarifas_status_catalogo_default` + `20260818131012_peajes_pwbi_tarifas` + `20260818144011_peajes_pwbi_pasadas_categoria_calculated`.
- Servicio: `src/app/components/peajes/services/peajes-auditoria-tarifas.service.ts`.
- Provider en `auditoria-tarifas.routes.ts` apunta al servicio Supabase (no mock).
- **Autovía del Mercosur (excepción Pattern A):** el CSV Telepase trae `CATEGORIA`, pero el código de proveedor no coincide con la clase tarifaria (p. ej. cat `7` agrupa 5×/6×/7×/9×). Las plantillas `MERCA-SUR-*` excluyen el destino `CATEGORIA` (`20260814180732_peajes_mercosur_plantillas_patron_a.sql`). Pasadas existentes: `categoria = NULL` + borrar niveles B + `peajes_recalcular_tarifas`. No tocar `importe_neto`. Post-condición RN-13/17: `Σ pasadas.importe_neto` vs `documentos.importe_sin_iva` (+ bonificación de cabecera) dentro del 1% (`peajes_validar_documento_id`). Tests: `supabase/tests/peajes_mercosur_patron_a_test.sql`.

---

> Última actualización: 2026-08-18
