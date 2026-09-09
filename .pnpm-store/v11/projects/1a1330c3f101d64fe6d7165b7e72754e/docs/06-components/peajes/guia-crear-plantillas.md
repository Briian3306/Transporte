# Guía de usuario — Crear plantillas y algoritmos (Peajes)

## Resumen

Cómo armar un **algoritmo combinado** (secuencia de limpiezas) y una **plantilla** (qué columnas del Excel se transforman y a qué columna estándar van). El destino del mapeo de patente es **`PATENTE_ID`** (como en Paso 5 del wizard), no el nombre de la columna del archivo.

## Índice

- [Conceptos](#conceptos)
- [Códigos atómicos vs nombres combinados](#códigos-atómicos-vs-nombres-combinados)
- [Ejemplo PATENTE (NORMALIZAR_PATENTE)](#ejemplo-patente-normalizar_patente)
- [Crear un algoritmo en la UI](#crear-un-algoritmo-en-la-ui)
- [Vincular a plantilla y a PATENTE_ID](#vincular-a-plantilla-y-a-patente_id)
- [Preview con datos de muestra](#preview-con-datos-de-muestra)
- [Usar en el wizard](#usar-en-el-wizard)
- [Verificación en Supabase](#verificación-en-supabase)

---

## Conceptos

| Pieza | Qué es | Dónde vive |
|-------|--------|------------|
| **Estrategia atómica** | Un paso del motor (`BORRAR_ESPACIOS`, `CONVERTIR_MAYUSCULAS`, …) | `StrategyRegistry` |
| **Algoritmo combinado** | Lista ordenada de atómicos reutilizable (p. ej. `NORMALIZAR_PATENTE`) | Tabla `algoritmos_combinados` + pasos |
| **Plantilla** | Configura columnas del archivo → destino estándar + algoritmo | `plantillas_configuracion` + `configuraciones_plantilla` |
| **Columna destino** | Campo de la Structure Goal (`PATENTE_ID`, `FECHA_HORA`, …) | Campo `columna_destino` de la config |

Regla: el algoritmo **no** define solo el ID de destino; la **plantilla** dice `nombre_columna` (Excel) → `columna_destino` (`PATENTE_ID`) y apunta al `algoritmo_combinado_id`.

---

## Códigos atómicos vs nombres combinados

- Solo se pueden referenciar códigos registrados en el frontend (`BORRAR_ESPACIOS`, `ELIMINAR_GUIONES`, `CONVERTIR_MAYUSCULAS`, …).
- Nombres como `NORMALIZAR_PATENTE` o `COMBINAR_FECHA_HORA` son **algoritmos combinados**, no códigos atómicos.
- En documentación antigua / SQL legacy, **UPPER** = `CONVERTIR_MAYUSCULAS` y **TRIM** = `BORRAR_ESPACIOS`.

---

## Ejemplo PATENTE (NORMALIZAR_PATENTE)

Receta sembrada (F06) y disponible en la UI con **Ejemplo PATENTE**:

| Orden | Código | Efecto |
|------:|--------|--------|
| 10 | `BORRAR_ESPACIOS` | Quita espacios |
| 20 | `ELIMINAR_GUIONES` | Quita `-` |
| 30 | `CONVERTIR_MAYUSCULAS` | Mayúsculas (UPPER) |

Plantillas sembradas:

| Plantilla | Origen Excel | Destino | Algoritmo |
|-----------|--------------|---------|-----------|
| ACCESO OESTE - Pasadas | `PATENTE` | `PATENTE_ID` | `NORMALIZAR_PATENTE` |
| Proveedor Demo - Pasadas | `DOMINIO` | `PATENTE_ID` | `NORMALIZAR_PATENTE` |

Ejemplo de efecto: ` ad-625-qb ` → `AD625QB` en `PATENTE_ID`.

---

## Crear un algoritmo en la UI

Ruta: `/peajes/plantillas` → pestaña **Algoritmos**.

1. Pulsá **Ejemplo PATENTE** (o **Nuevo** y armá los pasos a mano).
2. Elegí **Empresa** (o marcá recurso global).
3. Revisá los pasos: código + columna guiada (el JSON avanzado queda oculto salvo que lo abras).
4. Definí **Columna origen** / **Columna destino** del preview (`DOMINIO` → `PATENTE_ID`).
5. Pulsá **Actualizar preview** y mirá la tabla antes → después (igual idea que Paso 3 del wizard).
6. **Guardar** el algoritmo, o **Guardar + plantilla PATENTE_ID** para crear también una plantilla mínima que escribe en `PATENTE_ID`.

---

## Vincular a plantilla y a PATENTE_ID

En el builder de plantillas (`/peajes/plantillas` → Builder):

1. Seleccioná la empresa.
2. Agregá una config:
   - `nombre_columna`: columna del Excel (`DOMINIO` o `PATENTE`)
   - `columna_destino`: **`PATENTE_ID`**
   - `algoritmo_combinado_id`: el algoritmo guardado (`NORMALIZAR_PATENTE`)
3. Guardá la plantilla.

En el wizard, Paso 5 usa ese `PATENTE_ID` como origen de mapeo a la Structure Goal (etiqueta tipo “PATENTE_ID (pipeline)”).

---

## Preview con datos de muestra

El builder de algoritmos usa filas de ejemplo (caso PRD §21 / variantes con espacios y guiones), aplica el pipeline vía `PeajesMotorTransformacionService` y muestra columnas `origen.*` y `salida.*`. No hace falta subir un Excel para probar el efecto.

---

## Usar en el wizard

1. Paso 1: elegir **empresa** y, si querés, la plantilla.
2. Paso 3: el pipeline puede cargar la plantilla; el preview de 10 filas muestra el mismo tipo de efecto.
3. Paso 5: mapear `PATENTE_ID` (salida del pipeline) a la columna estándar de patente.

---

## Verificación en Supabase

Solo contra **Supabase CLI** (local):

```sql
SELECT e.nombre, a.nombre, p.orden, p.algoritmo_codigo
FROM algoritmo_combinado_pasos p
JOIN algoritmos_combinados a ON a.id = p.algoritmo_combinado_id
JOIN empresas e ON e.id::text = a.empresa_id
WHERE a.nombre = 'NORMALIZAR_PATENTE'
ORDER BY e.nombre, p.orden;

SELECT pl.nombre, c.nombre_columna, c.columna_destino, alg.nombre
FROM configuraciones_plantilla c
JOIN plantillas_configuracion pl ON pl.id = c.plantilla_id
LEFT JOIN algoritmos_combinados alg ON alg.id = c.algoritmo_combinado_id
WHERE c.columna_destino = 'PATENTE_ID';
```

Semilla: migración `20260803170620_peajes_acceso_oeste_demo_catalogos_plantillas.sql` en `supabase/migrations/`.

---

## Referencias

- Técnica del motor: [plantillas-y-algoritmos.md](./plantillas-y-algoritmos.md)
- Skill agente: `.agents/skills/peajes-plantillas-builder/SKILL.md`
- PRD §7 (plantillas), §21 (caso de aceptación)

---

> Última actualización: 2026-08-03
