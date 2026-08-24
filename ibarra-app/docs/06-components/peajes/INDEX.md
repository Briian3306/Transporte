# Índice — Componentes Peajes

## Resumen

Documentación de UI y servicios del módulo Peajes (wizard, catálogos, plantillas, shared). Backend/RPC: [docs/backend/](../../backend/index.md).

## Documentos

| Documento | Descripción |
|-----------|-------------|
| [wizard.md](./wizard.md) | Asistente de carga (pasos 1–9), estado y Excel |
| [ia-factura.md](./ia-factura.md) | F17 — rol y flujo de sugerencias IA de factura (PDF → chips Paso 7) |
| [importacion-masiva-consumos-resumen.md](./importacion-masiva-consumos-resumen.md) | F13 — ConsumosResumen / masiva multi-documento |
| [validacion-carga.md](./validacion-carga.md) | Paso 8: diagnóstico, tolerancia, errores RPC |
| [reconocimiento-columnas.md](./reconocimiento-columnas.md) | F02-11 / F14-3 — reconocimiento semántico + CATEGORIA |
| [reconocimiento-estaciones.md](./reconocimiento-estaciones.md) | F02-13 / RN-26 — estaciones por peaje/empresa |
| [auditoria-tarifas.md](./auditoria-tarifas.md) | F14-4 — uso de `/peajes/auditoria-tarifas` (botones, tablas, servicios) |
| [auditoria-estaciones.md](./auditoria-estaciones.md) | F16 — `/peajes/auditoria-estaciones`, Ver casos y clave canónica Paso 6 |
| [patentes-sin-resolver.md](./patentes-sin-resolver.md) | F02-14 — DataTable Agregar/Quitar en Paso 5 |
| [pipeline-editable-paso3.md](./pipeline-editable-paso3.md) | Pipeline editable Paso 3 (F02-10 / F03-9) |
| [catalogos.md](./catalogos.md) | CRUD UI empresas / peajes / estaciones / patentes / pases |
| [../shared/INDEX.md](../shared/INDEX.md) | Primitivas shared (DataTable, filtros, graph-loader) |
| [plantillas-y-algoritmos.md](./plantillas-y-algoritmos.md) | Motor Builder/Strategy + UI plantillas |
| [guia-crear-plantillas.md](./guia-crear-plantillas.md) | Guía de usuario: algoritmos y PATENTE_ID |
| [servicios-y-providers.md](./servicios-y-providers.md) | Contratos, mocks y swap a Supabase |

## Verificación UI

Ver `feature_list.json` (F02/F03/F13) y `docs/claude-progress.md`.

---

> Última actualización: 2026-08-24
