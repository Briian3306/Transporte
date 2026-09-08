# Propuesta PICO / NO_PICO — Excel enero–julio (6 peajes)

## Resumen

Script de **solo lectura** que, a partir de las pasadas ya importadas, propone `PICO` / `NO_PICO` para enero–junio usando **julio como fuente de verdad** (clasificación hecha a mano). El resultado es un Excel con columna **CONFIRMAR** para revisión humana. **No escribe** en Supabase.

Peajes con esquema horario: AUBASA, AUTOPISTA DEL OESTE, AUSA, CORREDORES VIALES SA, RUTAS SUR ATLANTICO S.A., AUSOL.

El resto de las concesiones no entra acá: se cubren con el update masivo `NO_PICO` de `ibarra-app/supabase/scripts/`.

## Índice

- [Resumen](#resumen)
- [Cómo generar el Excel](#cómo-generar-el-excel)
- [Algoritmo](#algoritmo)
- [Ejemplo AUSA / ILLIA II / cat 7](#ejemplo-ausa--illia-ii--cat-7)
- [Columnas del Excel](#columnas-del-excel)
- [Cómo usar CONFIRMAR](#cómo-usar-confirmar)
- [Autovalidación contra julio](#autovalidación-contra-julio)
- [Plan futuro de auditoría](#plan-futuro-de-auditoría)
- [Archivos](#archivos)
- [Referencias](#referencias)

---

## Cómo generar el Excel

Desde `ibarra-app`:

```powershell
node --test scripts/peajes-pico/classifier.test.mjs
node scripts/peajes-pico/generar-propuesta-pico.mjs
```

Salida: `scripts/peajes-pico/out/propuesta-pico-YYYYMMDD.xlsx`.

Entrada por defecto (dumps de solo lectura):

| Archivo | Origen |
|---------|--------|
| `scripts/peajes-pico/data/niveles-mensuales.json` | `extract-niveles-mensuales.sql` |
| `scripts/peajes-pico/data/histograma-pico-julio.json` | `extract-histograma-pico-julio.sql` |

Para refrescar los dumps, correr esos SQL contra DESARROLLO (SQL editor / MCP) y guardar el arreglo JSON. El generador **no** llama a Supabase para mutar; lee `.env.development` solo para recordar la URL si falta el dump.

```powershell
node scripts/peajes-pico/generar-propuesta-pico.mjs --from-json scripts/peajes-pico/data/niveles-mensuales.json
```

---

## Algoritmo

Unidad de trabajo: **familia** = peaje + estación + categoría (Patrón B). Cada fila del Excel es un **nivel** (importe) de esa familia en un mes.

1. **Referencia julio.** Por familia, toma los niveles de julio con `PICO` / `NO_PICO` confirmados. Calcula **R julio** = tarifa mayor / tarifa menor. Por peaje, deriva la ventana horaria pico (horas UTC de julio con ≥ 2 pasadas PICO; ignora outliers de 1 caso).
2. **Retro-propagación (junio → enero).** En cada mes, agrupa importes con tolerancia 0,5 % (centavos). Si julio tiene par PICO+NO_PICO: la tarifa **mayor** del mes → PICO, el resto → NO_PICO. Confianza **ALTA** si R del mes ≈ R julio (±2 %) y la suba mensual del piso y del techo está entre 0 % y +15 %. Si no, **MEDIA**.
3. **Julio solo NO_PICO.** Toda la familia en meses anteriores queda NO_PICO (estaciones “planas”).
4. **Verificador horario.** Si no hay referencia de julio, usa la ventana del peaje: tramo dentro de la ventana → PICO MEDIA; tramo de día completo (span ≥ 18 h) → NO_PICO MEDIA; resto → SIN_PROPUESTA.
5. **Patrón A** (categoría vacía, muchas tarifas en la misma estación): no se aplica “la mayor es PICO”. Solo horario / SIN_PROPUESTA. Julio se copia tal cual.
6. **Julio en el Excel.** No se re-adivina: se copia el status manual con confianza ALTA y motivo «Referencia julio (confirmado a mano)».

---

## Ejemplo AUSA / ILLIA II / cat 7

| Mes | NO_PICO | PICO | R |
|-----|---------|------|---|
| 2026-01 | 4.839,25 | 13.595,67 | 2,81 |
| 2026-06 | 5.920,50 | 16.633,40 | 2,81 |
| 2026-07 | 6.044,83 | 16.982,69 | 2,81 |

La inflación mueve los dos precios juntos. El clasificador **no compara importes absolutos entre meses**: compara ranking y R. En junio, ranking 1/2 + R 2,81 = R julio + suba ~2 % → **ALTA**.

PASEO DEL BAJO / cat 7 tiene un solo precio todos los meses (julio NO_PICO, horas 0–23) → NO_PICO ALTA.

---

## Columnas del Excel

Hoja **Propuesta** (una fila por estación + categoría + mes + importe):

| Columna | Contenido |
|---------|-----------|
| Peaje, Estacion, Categoria, Mes | Identidad de la familia |
| Importe, Casos | Nivel y volumen de pasadas del mes |
| **R (mayor/menor)** | `R = TARIFA MAYOR / TARIFA MENOR` de la familia en ese mes. Vacío si hay un solo nivel |
| **R julio** | El mismo ratio sobre julio confirmado. Si R ≈ R julio, la propuesta es sólida |
| Horas (min-max) | Rango horario UTC de las pasadas del nivel |
| Status propuesto | PICO / NO_PICO / SIN_PROPUESTA |
| Confianza | ALTA / MEDIA / — |
| Motivo | Ranking, R, suba, ventana horaria |
| **CONFIRMAR** | Vacía. Completar SI / NO (o dejar vacío = pendiente) |
| tarifa_normalizada_id | UUID del nivel en `tarifas_normalizadas` para un import futuro |

Hojas **Control** y **Ratios_julio**: autovalidación, ventanas pico por peaje, R de referencia por familia.

---

## Cómo usar CONFIRMAR

1. Filtrar **Confianza = ALTA** (excepto mes 2026-07, ya confirmado). Revisar que R ≈ R julio.
2. Marcar **CONFIRMAR = SI** en bloque. Las MEDIA: abrir `/peajes/auditoria-tarifas` → familia → **Ver casos** y decidir.
3. SIN_PROPUESTA: criterio humano (muestra chica, Patrón A, o tarifa que no es pico: p. ej. un tercer importe en AUBASA que no sigue R).
4. Aplicar en la pantalla de auditoría: el select PICO/NO_PICO + **Asignar status** (o **Comparar** para estaciones similares). Eso llama `peajes_confirmar_status_tarifa` y propaga `pasadas.tarifa_status`. Power BI `pwbi_pasadas` lo lee sin cambiar la vista.

**No hay importador automático en este entregable.** Un script futuro puede leer CONFIRMAR = SI y armar el JSON de `peajes_confirmar_status_tarifa` usando `tarifa_normalizada_id`.

---

## Autovalidación contra julio

Antes de exportar, el script clasifica julio **a ciegas** (máximo = PICO, resto = NO_PICO, o “solo NO_PICO”) y lo compara con tu etiqueta manual, **solo Patrón B**.

Corrida 2026-08-31 (DESARROLLO): **123 / 132 = 93,2 %** (target 95 %).

| Peaje | Coincidencia |
|-------|----------------|
| AUSA | 35/35 (100 %) |
| AUSOL | 22/22 (100 %) |
| AUTOPISTA DEL OESTE | 39/39 (100 %) |
| AUBASA | 27/36 (75 %) |

AUBASA baja el promedio: hay familias con 3+ importes en el mismo mes (suba intra-mes + pico) donde el máximo no siempre es el PICO confirmado. Esas filas salen MEDIA / SIN_PROPUESTA a propósito. CORREDORES VIALES y RUTAS SUR en julio están sobre todo en Patrón A (sin categoría) y no entran al KPI.

---

## Plan futuro de auditoría

Por qué esta información es valiosa:

- **Control de facturación.** R por familia es un contrato implícito. Un mes con R = 3,4 donde siempre fue 2,81 (o una suba mensual > 15 %) es pasada mal cobrada o error de importación.
- **Optimización de flota.** Con `tarifa_status` completo, Power BI puede medir sobrecosto pico = (R − 1) × importe base × casos, por patente, estación y mes.
- **Cambio de cuadro tarifario.** Si la concesión cambia la ventana pico o agrega un tercer nivel, aparecen SIN_PROPUESTA o R nuevos.

Tres niveles recurrentes (no implementados ahora):

1. **Mensual hacia adelante.** Cuando entre agosto, el mismo script usa el último mes confirmado como referencia. KPI: % ALTA ≥ 90 %.
2. **Consistencia en Supabase.** Query (posible RPC `peajes_auditar_ratios`) de (a) `pasadas.tarifa_status` ≠ status del nivel, (b) R del mes desvía > 5 % del R histórico, (c) PICO fuera de la ventana del peaje.
3. **Negocio en Power BI.** Sobrecosto pico por mes/patente/estación y tendencia de R por concesión.

Paso de aplicación: importar Excel con CONFIRMAR = SI → `peajes_confirmar_status_tarifa`.

---

## Archivos

| Path | Rol |
|------|-----|
| `scripts/peajes-pico/classifier.mjs` | Motor puro (ranking, R, horario) |
| `scripts/peajes-pico/classifier.test.mjs` | Tests (`node --test`) |
| `scripts/peajes-pico/generar-propuesta-pico.mjs` | Excel Propuesta + Control + Ratios_julio |
| `scripts/peajes-pico/out/propuesta-pico-*.xlsx` | Entregable para confirmar |
| `supabase/scripts/verificacion_no_pico_masivo.sql` | Parte 1 — conteos antes del UPDATE |
| `supabase/scripts/update_no_pico_masivo.sql` | Parte 1 — UPDATE (no ejecutado por el agente) |
| `supabase/scripts/postvalidacion_no_pico_masivo.sql` | Parte 1 — chequeo después del COMMIT |

---

## Referencias

- Pantalla: [auditoria-tarifas.md](./auditoria-tarifas.md)
- Backend / RPC: [auditoria-tarifas.md](../../backend/peajes/auditoria-tarifas.md)
- Reconocimiento CATEGORIA: [reconocimiento-columnas.md](./reconocimiento-columnas.md)

---

> Última actualización: 2026-08-31
