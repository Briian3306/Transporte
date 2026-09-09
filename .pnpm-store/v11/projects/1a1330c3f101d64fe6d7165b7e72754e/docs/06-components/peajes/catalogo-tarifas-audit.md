# Auditoría de catálogo tarifario — Excel (Fase 1)

## Resumen

Script de **solo lectura** que analiza `pwbi_tarifas_rows.csv` y genera un Excel para revisión humana del catálogo futuro `PEAJE + ESTACIÓN + STATUS + CATEGORY`. Detecta categorías, precios y pares `PICO` / `NO_PICO` sospechosos **sin inventar** un `1..7` universal. **No escribe** en Supabase ni toca `tarifas_normalizadas`.

El Excel corregido a mano (columna `ACTION`) será la fuente de la migración a `tarifas` + `tarifa_importe` en una fase posterior. Esa migración **aún no corre**: Wave 0 solo dejó fixtures CSV/Excel de prueba.

## Índice

- [Resumen](#resumen)
- [Cómo generar el Excel](#cómo-generar-el-excel)
- [Fixtures de prueba (Wave 0)](#fixtures-de-prueba-wave-0)
- [Algoritmo](#algoritmo)
- [Hojas](#hojas)
- [Columnas del catálogo](#columnas-del-catálogo)
- [Cómo usar ACTION](#cómo-usar-action)
- [Archivos](#archivos)

---

## Cómo generar el Excel

Desde `ibarra-app`:

```powershell
node --test scripts/peajes-catalogo-audit/classifier.test.mjs
node scripts/peajes-catalogo-audit/generar-auditoria.mjs --csv ../pwbi_tarifas_rows.csv
```

Salida: `scripts/peajes-catalogo-audit/out/auditoria-catalogo-YYYYMMDD.xlsx`.

`--csv` apunta al dump de `pwbi_tarifas`. Por defecto usa `pwbi_tarifas_rows.csv` en la raíz del repo. `--out` permite otra ruta. El script no usa `.env` ni el cliente Supabase.

---

## Fixtures de prueba (Wave 0)

Muestras con **todas** las tarifas PICO/NO_PICO del dump, en la forma de las futuras tablas. **No** crean esas tablas en Supabase.

Desde `ibarra-app`:

```powershell
node --test scripts/peajes-catalogo-audit/*.test.mjs
node scripts/peajes-catalogo-audit/write-sample-files.mjs
```

| Archivo | Rol |
|---------|-----|
| `scripts/peajes-catalogo-audit/fixtures/tarifas.csv` | Catálogo completo (peaje + estación + status + categoría) |
| `scripts/peajes-catalogo-audit/fixtures/tarifas_importe.csv` | Todos los importes (1:N por `tarifa_id`) |
| `scripts/peajes-catalogo-audit/out/tarifas-tarifas-importe.xlsx` | Solo pestañas `tarifas` y `tarifas_importe` |

`PENDIENTE` no entra al catálogo. No sobrescribe `out/auditoria-catalogo-20260904.xlsx`.

---

## Algoritmo

Unidad de catálogo: peaje + estación + `STATUS` ∈ {`PICO`,`NO_PICO`} + `Categoria_Normalizada`. Varios importes históricos se colapsan a la fila más reciente por `fecha_aparicion`. `PENDIENTE` no es un tipo tarifario: si ya hay PICO/NO_PICO, queda en History; si la categoría solo existe como `PENDIENTE`, una fila `REVIEW_REQUIRED`.

1. **Clusters por peaje.** `has_pico` (alguna fila `PICO` confirmada) vs `flat`.
2. **CORREDORES VIALES SA** se parte en esos dos clusters:
   - rural / `flat` → esperado `1-5`, solo `NO_PICO`
   - urbano / `has_pico` → esperado `1-6` o `1-7` (máximo del cluster) con PICO y NO_PICO
3. **Otros dual-status con categoría 1** → consecutivo `1..max`.
4. **AUSA / AUBASA y similares** (no empiezan en 1) → conjunto por mayoría de pares (≥ 60 %), p. ej. `2,4,7,8,9`. Nunca un `1-7` forzado.
5. **Estaciones sparse** (≤ 2 categorías) muestran `CATEGORIES_MISSING` pero no inventan filas gap; `REVIEW_REQUIRED` si el peaje tiene pico y la estación es plana (salvo Corredores rural). `PASEO DEL BAJO` y `MAIPU` no reciben filas PICO inventadas.

Categoría faltante en un cluster dual-status → **dos** filas gap (PICO y NO_PICO). Cluster solo NO_PICO → una fila. `DIAGNOSTIC` queda vacío si no hay `MISSING_*` ni `REVIEW_REQUIRED`.

---

## Hojas

| Hoja | Contenido |
|------|-----------|
| Catalogue | Catálogo observado + gaps sintéticos (forma futura de `tarifas`) |
| Missing Categories | Solo `MISSING_CATEGORY=TRUE` |
| Missing Prices | Solo `MISSING_PRICE=TRUE` |
| Missing Status | Solo `MISSING_STATUS=TRUE` |
| Catalogue Summary | Una fila por estación; filtrar `categories_missing` |
| History | Las 1142 filas origen |
| Patterns | Cluster inferido y categorías esperadas |
| Control | Conteos, reglas y uso de `ACTION` |

---

## Columnas del catálogo

En cada fila (existente o gap):

- `CATEGORIES_DETECTED` / `EXPECTED_CATEGORIES` / `CATEGORIES_MISSING`
- `STATUSES_DETECTED` / `EXPECTED_STATUSES` / `STATUSES_MISSING`
- `IMPORTE` (último por `fecha_aparicion`; vacío en gaps)
- `MISSING_CATEGORY`, `MISSING_PRICE`, `MISSING_STATUS`, `REVIEW_REQUIRED` (`TRUE` o vacío)
- `DIAGNOSTIC` (vacío en filas limpias)
- `ACTION` para completar a mano: `KEEP` / `ADD` / `IGNORE`

Ejemplo BERAZATEGUI categoría 2 ausente:

```text
AUBASA | BERAZATEGUI | PICO    | 2 |          | TRUE | Missing category 2
AUBASA | BERAZATEGUI | NO_PICO | 2 |          | TRUE | Missing category 2, because have PICO and doesn't have NO_PICO
```

---

## Cómo usar ACTION

1. Abrir **Catalogue Summary** y filtrar `categories_missing` no vacío.
2. Revisar las filas gap en Catalogue / Missing Categories / Missing Status.
3. Completar `ACTION`:
   - `KEEP` — el catálogo observado es correcto
   - `ADD` — el gap es real; incluirlo en la migración
   - `IGNORE` — el algoritmo se equivocó; no inventar la tarifa
4. Devolver el Excel corregido. No se aplica ningún UPDATE hasta esa revisión.

---

## Archivos

| Archivo | Rol |
|---------|-----|
| `scripts/peajes-catalogo-audit/parse-csv.mjs` | Parser CSV |
| `scripts/peajes-catalogo-audit/classifier.mjs` | Clusters, esperado y flags |
| `scripts/peajes-catalogo-audit/classifier.test.mjs` | Casos AUSA / AUBASA / Corredores / CAMINO REAL |
| `scripts/peajes-catalogo-audit/generar-auditoria.mjs` | Escritura del `.xlsx` |
| `scripts/peajes-catalogo-audit/out/` | Excel generado |
| `scripts/peajes-catalogo-audit/fixtures/tarifas.csv` | Catálogo completo `tarifas` |
| `scripts/peajes-catalogo-audit/fixtures/tarifas_importe.csv` | Importes `tarifas_importe` |
| `scripts/peajes-catalogo-audit/write-sample-files.mjs` | Escribe los dos CSV y el Excel de 2 pestañas |

Entrada: [`pwbi_tarifas_rows.csv`](../../../../pwbi_tarifas_rows.csv) (raíz del repo).

---

> Última actualización: 2026-09-04
