# F14 — Auditoría de Pasadas por Patrones · Índice

## Resumen

Esta carpeta contiene el paquete completo de planificación de la épica **F14 — Auditoría de Pasadas por Patrones (Normalización Tarifaria)**: el análisis de las `pasadas` ya importadas para inferir o auditar la estructura tarifaria de cada estación y separar la variación por categoría de vehículo de un probable recargo por franja horaria, con la clasificación final siempre a cargo de una persona.

El plan maestro y los apéndices A–D son documentos de planificación: no implementan nada ni autorizan apply por sí solos.

El plan operativo de plantillas **sí** describe la migración jsonb, el apply en DESARROLLO y el checklist de QA. Ejecutarlo requiere autorización explícita; nunca `db reset --linked`.

## Documentos

| Documento | Contenido | Agente propietario |
|---|---|---|
| [PLAN-auditoria-pasadas-patrones.md](./PLAN-auditoria-pasadas-patrones.md) | Plan maestro: alcance, patrones A/B, modelo de dos capas, arquitectura end-to-end, división por agentes, checklists de backend/frontend/testing, contrato de RPCs, riesgos y trazabilidad. | Plan maestro (este paquete) |
| [APENDICE-A-modelo-datos-sql.md](./APENDICE-A-modelo-datos-sql.md) | DDL de `tarifas_normalizadas`, `tarifas_parametros_peaje` y `tarifas_status_catalogo`, `ALTER TABLE pasadas`, índices, RLS, trigger de validación de status y enganche post-carga sobre `peajes_confirmar_carga`. | `01-backend-supabase` |
| [APENDICE-B-deteccion-categoria-y-mapeo.md](./APENDICE-B-deteccion-categoria-y-mapeo.md) | Alias y detección de la columna `CATEGORIA` en el Paso 2, destino opcional `CATEGORIA` en el Paso 5 y persistencia de `pasadas.categoria` como texto crudo del proveedor. | `02-frontend-wizard-tablas` |
| [APENDICE-C-pantalla-auditoria-frontend.md](./APENDICE-C-pantalla-auditoria-frontend.md) | Especificación UI/UX de `/peajes/auditoria-tarifas`: filtros, tabla padre/detalle, panel de comparación de niveles, badges dinámicos por catálogo y tarjeta en `peajes-home`. | `02-frontend-wizard-tablas` |
| [APENDICE-D-testing-y-dataset-referencia.md](./APENDICE-D-testing-y-dataset-referencia.md) | Plan de pruebas unitarias, de SQL y E2E, más la descripción del dataset de referencia (119 filas del CSV de unión y 1711 pasadas en base), prueba empírica UTC y hueco ZARATE-1500/NC. | `05-integrador-qa` |
| [PLAN-plantillas-categoria-mapeos-y-apply.md](./PLAN-plantillas-categoria-mapeos-y-apply.md) | Plan operativo: activar `CATEGORIA → CATEGORIA` en plantillas Telepase, migración jsonb, apply en DESARROLLO (`kfffigvyvtzyczeiadxh`) y checklist de testing. No re-backfillea pasadas ni toca `MASIVOOO`. | `01-backend-supabase` + QA |
| INDEX.md | Este índice. | — |

## Cómo usar este plan

Todo agente lee primero el **plan maestro completo** y después solo su apéndice. El plan maestro define los nombres canónicos de tablas, RPCs y rutas; ningún apéndice puede contradecirlo.

| Agente | Orden de lectura |
|---|---|
| `00-orquestador-setup` | Plan maestro §3, §6 y §7.2 (bloque *Contrato*). Entrega **F14-0** y comitea antes de que arranque cualquier otro. |
| `01-backend-supabase` | Plan maestro completo → Apéndice A → Apéndice B. Ejecuta **F14-1** y **F14-2** en ese orden. |
| `02-frontend-wizard-tablas` | Plan maestro completo → Apéndice B (para **F14-3**) → Apéndice C (para **F14-4**). |
| `04-documentador` | Plan maestro §5, §8 y §11, más el estado real en `feature_list.json`. Documenta solo lo que ya está `passing` (**F14-5**). |
| `05-integrador-qa` | Plan maestro §7.3, §9 y §10 → Apéndice D. Ejecuta **F14-6** al final, en serie. |

Antes de tocar cualquier archivo, revisar la tabla de ownership de `ibarra-app/AGENTS.md` y el subapartado `### F14`. Las necesidades cruzadas se anotan en `docs/session-handoff.md`; no se editan archivos de otro agente.

## Referencias

- Fuentes originales: [PRD de normalización tarifaria](../normalizacion-tarifa/PRD_Feature_Normalizacion_Tarifaria.md) y [plan técnico v2](../normalizacion-tarifa/PLAN_Backend_Frontend_Tarifas_Normalizadas.md).
- Fuente de verdad de RF/RN: [peaje-prd-es.md](../peaje-prd-es.md).
- Índice general de planes: [../INDEX.md](../INDEX.md).
- Estado y evidencia: `../../../feature_list.json`.

> Última actualización: 2026-08-13
