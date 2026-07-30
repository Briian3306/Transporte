# Tablas — Plantillas y algoritmos

## Resumen

Esquema de plantillas de configuración y algoritmos combinados (F01-3, F01-4). Dominio propio: **no** usa `checklist_templates`. Migraciones `20260730125523_peajes_plantillas.sql` y `20260730125529_peajes_algoritmos.sql`.

## Índice

- [Resumen](#resumen)
- [plantillas_configuracion](#plantillas_configuracion)
- [configuraciones_plantilla](#configuraciones_plantilla)
- [algoritmos_combinados](#algoritmos_combinados)
- [algoritmo_combinado_pasos](#algoritmo_combinado_pasos)
- [peajes_algoritmos_catalogo](#peajes_algoritmos_catalogo)
- [Nota: códigos SQL vs motor TS](#nota-códigos-sql-vs-motor-ts)
- [Referencias](#referencias)

---

## plantillas_configuracion

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | — |
| `nombre` | text | No | UK con `empresa_id` |
| `descripcion` | text | Sí | — |
| `empresa_id` | text | No | Empresa o `'__global__'` |
| `estrategia_codigo` | text | Sí | Metadata opcional |
| `estado` | text | No | `borrador` \| `activa` \| `inactiva` |
| `created_at` / `updated_at` | timestamptz | No | Trigger `peajes_set_updated_at` |

---

## configuraciones_plantilla

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | — |
| `plantilla_id` | uuid FK | No | CASCADE |
| `nombre_columna` | text | No | Columna origen / lógica |
| `columna_destino` | text | Sí | Clave Structure Goal u otra |
| `orden` | integer | No | ≥ 0 |
| `tipo` | text | No | `transformacion` \| `mapeo` \| `validacion` |
| `algoritmo_combinado_id` | uuid FK | Sí | SET NULL; FK diferida tras algoritmos |
| `configuracion` | jsonb | Sí | Parámetros (default `{}`) |
| `obligatoria` | boolean | No | Default false |

UK: `(plantilla_id, nombre_columna, orden)`.

Sobrescritura atómica: RPC `peajes_sobrescribir_configuraciones_plantilla` (RN-19 / RF-28).

---

## algoritmos_combinados

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | — |
| `nombre` | text | No | UK con `empresa_id` |
| `descripcion` | text | Sí | — |
| `empresa_id` | text | No | Empresa o `'__global__'` |
| `estado` | text | No | `borrador` \| `activa` \| `inactiva` |
| `created_at` / `updated_at` | timestamptz | No | Trigger updated_at |

---

## algoritmo_combinado_pasos

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `id` | uuid PK | No | — |
| `algoritmo_combinado_id` | uuid FK | No | CASCADE |
| `orden` | integer | No | ≥ 0; UK con algoritmo |
| `algoritmo_codigo` | text FK → catálogo | No | Solo códigos registrados |
| `parametros` | jsonb | Sí | Default `{}` |

RPCs: `peajes_validar_algoritmo_combinado`, `peajes_expandir_algoritmo`, `peajes_guardar_algoritmo_combinado`.

---

## peajes_algoritmos_catalogo

Catálogo semilla en BD (códigos permitidos por FK):

`COMBINAR_FECHA_HORA`, `NORMALIZAR_PATENTE`, `TRIM`, `UPPER`, `LOWER`, `REPLACE`, `PAD_LEFT`, `CAST_NUMBER`, `CAST_DATE`, `MAP_VALUE`, `DEFAULT_VALUE`, `SPLIT`, `CONCAT`

RLS: SELECT para `authenticated` (catálogo de solo lectura).

---

## Nota: códigos SQL vs motor TS

El motor frontend (`StrategyRegistry`, F03) registra códigos distintos, alineados al PRD de transformaciones UI:

`BORRAR_ESPACIOS`, `ELIMINAR_GUIONES`, `CONVERTIR_MAYUSCULAS`, `COMBINAR_COLUMNAS`, `FORMATEAR_FECHA_HORA`, `CALCULAR_IMPORTE_NETO`, `CONVERTIR_NUMERO`, `CONVERTIR_TEXTO`, `ASIGNAR_VALOR`, `COPIAR_COLUMNA`

**Gap conocido para Agente 05 / follow-up:** alinear catálogo SQL ↔ códigos del motor (o capa de mapeo) antes de persistir algoritmos desde la UI real. Documentado; no inventado como “ya resuelto”.

---

## Referencias

- SQL: migraciones plantillas + algoritmos
- Servicio: `PeajesPlantillasSupabaseService`
- UI/motor: [docs/06-components/peajes/plantillas-y-algoritmos.md](../../06-components/peajes/plantillas-y-algoritmos.md)

---

> Última actualización: julio 2026
