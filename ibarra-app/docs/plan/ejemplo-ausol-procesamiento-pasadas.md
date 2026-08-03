# Ejemplo AUSOL — procesamiento de pasadas `557074.csv`

## Resumen

Este caso documenta la adaptación del archivo real [557074.csv](./csv/557074.csv) al modelo estándar de pasadas. Complementa el [ejemplo MVP](./ejemplo-mvp-procesamiento-pasadas.md): AUSOL ya entrega fecha y hora ISO, pero requiere resolver estaciones por nombre sin crear duplicados.

## Archivo fuente

| Propiedad | Valor |
|---|---|
| Archivo | `docs/plan/csv/557074.csv` |
| Separador | `;` |
| Filas | `191` |
| Estaciones distintas | `12` |
| Pases distintos | `45` |
| Patentes distintas | `45` |
| Neto esperado | `678607.05` |

Columnas de interés: `FECHA`, `HORA`, `ESTACION`, `DISPOSITIVO`, `PATENTE`, `TARIFA` y `BONIFICACION`. `VIA` y los campos de documento/cuenta no alimentan el Structure Goal de este ejemplo.

## Pipeline y plantilla AUSOL

| Orden | Origen | Destino | Operación |
|---:|---|---|---|
| 10 | `FECHA` + `HORA` | `FECHA_HORA` | Combinar con espacio; el CSV ya usa ISO y `HH:MM:SS`. |
| 20 | `PATENTE` | clave de búsqueda / `PATENTE_ID` | `NORMALIZAR_PATENTE`: trim, quitar guiones y mayúsculas; luego resolver el UUID de catálogo. |
| 30 | `DISPOSITIVO` | `PASE_ID` | Texto/trim; luego resolver el UUID de catálogo. |
| 40 | `ESTACION` | clave de búsqueda / `ESTACION_ID` | Normalizar, aplicar aliases configurados y ejecutar el Reconocedor. |
| 50 | `TARIFA` | `PRECIO` | Conversión numérica. |
| 60 | `BONIFICACION` | `BONIFICACION` | Conversión numérica. |
| 70 | `PRECIO` - `BONIFICACION` | `IMPORTE_NETO` | `CALCULAR_IMPORTE_NETO`. |
| 80 | valor fijo | `QUANTITY` | `ASIGNAR_VALOR { valor: 1 }`. |

La plantilla se asocia a la empresa `AUSOL`. Los algoritmos combinados se expanden mediante `PipelineBuilder` y solo se ejecutan estrategias registradas en `StrategyRegistry` (RN-18/RN-20).

## Reemplazo de texto y Reconocedor de estaciones

Antes de comparar contra el catálogo, la plantilla puede aplicar `REEMPLAZAR_TEXTO` con reglas ordenadas `{ buscar, reemplazar }`. Ejemplo: `BD` → `BLACK DECK`. Es una transformación de valores, no ejecuta código almacenado en `jsonb`.

El Reconocedor trabaja dentro de la empresa AUSOL y sigue esta prioridad:

1. Alias confirmado exacto.
2. Nombre canónico `ZONA` exacto.
3. Sugerencias parciales ordenadas para confirmación humana.

Una sugerencia parcial no relaciona ni crea datos por sí sola. Por ejemplo, ante el valor `BUEN AYRE ASCENDENTE`, el usuario puede confirmar que corresponde a `BUEN AYRE (ID: …)` o indicar que ninguna opción coincide. Solo esta segunda decisión habilita crear una estación nueva y guardar su alias para cargas futuras.

Los valores de este archivo incluyen `BUEN AYRE ASCENDENTE`, `BUEN AYRE DESCENDENTE`, `CAMINO REAL ASCENDENTE`, `CAMINO REAL DESCENDENTE`, `CAMPANA`, `CAMPANA DECALADA`, `DEBENEDETTI ASCENDENTE`, `PILAR`, `RUTA 197 ASCENDENTE`, `RUTA 197 DESCENDENTE`, `RUTA 202 ASCENDENTE` y `TIGRE`.

## Resultado esperado

Cada fila válida queda con `FECHA_HORA`, UUID de pase, patente y estación, `PRECIO`, `BONIFICACION`, `QUANTITY = 1` e `IMPORTE_NETO`. La factura de prueba debe usar `importe_sin_iva = 678607.05`; la carga solo puede confirmarse si la diferencia es `0.00`, todas las estaciones fueron resueltas y no hay duplicados.

## Referencias

- [Prueba reproducible AUSOL](./prueba-workflow-557074-ausol.md)
- [Ejemplo MVP](./ejemplo-mvp-procesamiento-pasadas.md)
- [Plan de pruebas](./testing_plan.md)
- Motor: `.agents/skills/peajes-transformaciones-motor/`

