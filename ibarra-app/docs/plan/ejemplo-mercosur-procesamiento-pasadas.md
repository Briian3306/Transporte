# Ejemplo Autovía del Mercosur — procesamiento `pasadas_2026-07-01_79157`

## Resumen

Este caso documenta la adaptación del archivo real [pasadas_2026-07-01_79157.csv](./csv/pasadas_2026-07-01_79157.csv) (export Telepase MERCOSUR / julio) al modelo estándar de pasadas. Complementa el [ejemplo MVP](./ejemplo-mvp-procesamiento-pasadas.md) y el [ejemplo AUSOL](./ejemplo-ausol-procesamiento-pasadas.md): el CSV mezcla varias estaciones, pero la factura **A-00015-00079157** solo cubre la estación `1` (`0001`).

Sin filtro, Σ TARIFA de las 540 filas es `7932125.41` y no concilia. Con `FILTRAR_COLUMNA` sobre `ESTACION = 1` quedan **164** filas y Σ TARIFA = **4721445.29** (= TOTAL de factura).

## Archivo fuente

| Propiedad | Valor |
|---|---|
| Archivo | `docs/plan/csv/pasadas_2026-07-01_79157.csv` |
| Origen operativo | `scripts/downloads/MERCOSUR/julio/pasadas_2026-07-01_79157.csv` |
| Separador | `;` |
| Filas | `540` |
| Estaciones | `0001` (164), `0002` (131), `0003` (124), `0004` (121) |
| Factura | `facturas_2026-07-01_79157.pdf` (mismo directorio downloads) |
| TOTAL factura | `4721445.29` |
| Subtotal factura | `3902020.90` (≈ TOTAL ÷ 1.21) |

Columnas de interés: `FECHA`, `HORA`, `ESTACION`, `DISPOSITIVON`, `DOMINIO`, `TARIFA`, `BONIFICACION`. `VIA` y los campos de documento/cuenta no alimentan el Structure Goal de este ejemplo.

`CATEGORIA` del CSV Telepase **no se mapea** (Patrón A). El código de proveedor no coincide con la clase tarifaria (cat `7` mezcla varios múltiplos del importe base). Destino `CATEGORIA` queda excluido en las plantillas `MERCA-SUR-*`.

`ESTACION` llega padded (`0001`); el filtro acepta `valor: 1` / `"1"` / `"0001"` como equivalentes numéricos.

## Pipeline y plantilla MERCOSUR

| Orden | Origen | Destino | Operación |
|---:|---|---|---|
| 5 | `ESTACION` | (filtro de filas) | `FILTRAR_COLUMNA` `{ columna: "ESTACION", valor: "1" }` — descarta filas que no coinciden. |
| 10 | `FECHA` + `HORA` | `FECHA_HORA` | `FORMATEAR_FECHA_HORA` (`HHMMSS`; FECHA ya ISO). |
| 20–40 | `DOMINIO` | `PATENTE_ID` | `NORMALIZAR_PATENTE`: trim, quitar guiones y mayúsculas. |
| 50 | `DISPOSITIVON` | `PASE_ID` | `COPIAR_COLUMNA`. |
| 60 | `TARIFA` | `PRECIO` | `CONVERTIR_NUMERO` (decimal con punto). |
| 70 | `BONIFICACION` | `BONIFICACION` | `CONVERTIR_NUMERO`. |
| 80 | `PRECIO` − `BONIFICACION` | `IMPORTE_NETO` | `CALCULAR_IMPORTE_NETO`. |
| 90 | valor fijo | `QUANTITY` | `ASIGNAR_VALOR { valor: 1 }`. |

La plantilla se asocia a la empresa Autovía del Mercosur. Los algoritmos combinados se expanden mediante `PipelineBuilder` y solo se ejecutan estrategias registradas en `StrategyRegistry` (RN-18/RN-20). `FILTRAR_COLUMNA` está en `peajes_algoritmos_catalogo` (migración `20260811190002_peajes_algoritmo_filtrar_columna.sql`).

### Parámetros del filtro

```json
{
  "algoritmo_codigo": "FILTRAR_COLUMNA",
  "columna": "ESTACION",
  "valor": "1"
}
```

El motor no escribe una columna destino para este paso: si el valor no coincide, la fila se **omite** del resultado de `aplicarPipeline`.

## Factura y conciliación

| Concepto | Importe |
|---|---:|
| Σ TARIFA (todas las estaciones) | 7932125.41 |
| Σ TARIFA tras `ESTACION = 1` | **4721445.29** |
| TOTAL factura (con IVA) | **4721445.29** |
| Subtotal factura | 3902020.90 |
| IVA RI (factura) | 819424.39 |

Para validar contra el **subtotal** en Paso 7 se puede encadenar `ELIMINAR_IVA` (÷ 1.21) sobre `IMPORTE_NETO` tras el cálculo neto; este ejemplo fija la verdad operativa en el TOTAL con IVA = Σ TARIFA filtrada.

## Resultado esperado

Tras el filtro y el pipeline:

- **164** pasadas estandarizadas.
- Cada fila con `FECHA_HORA`, `PATENTE_ID`, `PASE_ID`, `PRECIO`, `BONIFICACION`, `QUANTITY = 1`, `IMPORTE_NETO`.
- Σ `IMPORTE_NETO` (sin `ELIMINAR_IVA`) = **4721445.29**.
- Estación canónica se resuelve en Paso 5/6 (catálogo / aliases) a partir del código proveedor `1` / `0001`.

## Referencias

- Fixture: `src/app/components/peajes/plantillas/mocks/mercosur.fixture.ts`
- [Ejemplo MVP](./ejemplo-mvp-procesamiento-pasadas.md)
- [Ejemplo AUSOL](./ejemplo-ausol-procesamiento-pasadas.md)
- Motor: `.agents/skills/peajes-transformaciones-motor/`
- Catálogo SQL: `supabase/migrations/20260811190002_peajes_algoritmo_filtrar_columna.sql`
