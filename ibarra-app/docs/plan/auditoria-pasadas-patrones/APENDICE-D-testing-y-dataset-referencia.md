# Apéndice D — Testing y dataset de referencia

Épica **F14 — Auditoría de Pasadas por Patrones (Normalización Tarifaria)** · Feature **F14-6** (agente 05).

Documentos hermanos:

- `PLAN-auditoria-pasadas-patrones.md` — alcance y secuencia.
- `APENDICE-A-modelo-datos-sql.md` — DDL y firmas de RPC. **Este apéndice no reescribe SQL: lo prueba.**
- `APENDICE-B-deteccion-categoria-y-mapeo.md` — reglas de detección Patrón A/B y mapeo de `CATEGORIA`.
- `APENDICE-C-pantalla-auditoria-frontend.md` — la pantalla que se prueba en §6 y §7.

Todas las cifras de §2 y §4 fueron **recalculadas** desde los archivos fuente el 2026-08-12; §4 indica para cada una la columna exacta y el método. Las que no se pudieron reproducir están marcadas como tales, no repetidas.

---

## 1. Estrategia de pruebas

Cuatro capas, cada una con una cosa distinta que demostrar. Ninguna reemplaza a otra.

| Capa | Herramienta | Qué prueba | Qué NO prueba |
|---|---|---|---|
| **SQL / pgTAP** | Supabase CLI local (`npx supabase db reset --local --no-seed` + `npx supabase test db`) | Constraints, triggers de validación de `status`, cálculo de `diagnostico`, idempotencia, propagación a `pasadas`, bordes de `stddev` | Nada de UI ni de formato |
| **Unit Angular** | Karma + Jasmine (`ng test`) | Render de botones desde el catálogo, sugerencia ascendente, armado de `p_asignaciones`, expand/collapse, badge con código desconocido, debounce, estados vacío/error, contrato de accesibilidad del diálogo | La RPC real |
| **Verify offline** | `tsx` sobre un `*.verify.ts` | La lógica pura de clasificación y sugerencia, sin Angular ni Karma, corriendo sobre el CSV de referencia completo | Cualquier cosa que toque el DOM |
| **E2E manual** | DESARROLLO `kfffigvyvtzyczeiadxh`, solo lectura salvo la carga de prueba | Que el hook post-guardado corra, que las familias se generen con datos reales, que la clasificación se propague y que Power BI vea el resultado | Regresiones automáticas |

### 1.1 Política de entornos (obligatoria)

`AGENTS.md` de `ibarra-app` y la skill `backend-supabase-write` lo fijan sin ambigüedad:

- **Las migraciones se prueban localmente con el Supabase CLI.** `npx supabase db reset --local --no-seed` seguido de `npx supabase test db` es el único ciclo válido para validar DDL, triggers y RPC nuevas.
- **DESARROLLO no es un entorno de testing.** Es el entorno de desarrollo remoto y contiene datos que el equipo usa. Contra DESARROLLO solo se corren: la carga E2E acordada de §8 y consultas `SELECT` de verificación. Prohibido `db push` de una migración no probada localmente, `db reset --linked` y cualquier `UPDATE`/`DELETE` masivo sobre `pasadas`.
- Refs prohibidas (OrdenCompra, no pertenecen a este proyecto): `edxoqshrzdqpnldktpzy`, `uurlssweuhshbwpxxatw`.

### 1.2 Pirámide

```text
   E2E manual DESARROLLO      ← 1 carga real + SELECTs de verificación (§8)
   Verify offline (tsx)       ← clasificación pura sobre las 119 filas del CSV (§7.3)
   Unit Angular (Karma)       ← componentes de la pantalla (§6)
   pgTAP (Supabase CLI local) ← reglas de datos (§5)
```

La base es ancha a propósito: la mayor parte del riesgo de esta épica está en el SQL (bordes de `stddev`, unicidad con `NULL`, propagación), no en el render.

---

## 2. Dataset de referencia

### 2.1 Procedencia

| Artefacto | Ruta | Contenido |
|---|---|---|
| Libro 1 | `scripts/telepeaje plus/202607-2/ConsumosResumen.xlsx` | hoja `RESULTADO_1`, **1040 filas de datos** |
| Libro 2 | `scripts/telepeaje plus/202607-1/ConsumosResumen-202607-1.xlsx` | hoja `RESULTADO_1`, **696 filas de datos** |
| Unión analizada | `scripts/telepeaje plus/taifa_normalizacion_test/tarifa_test_resumen_union.csv` | **119 filas de datos**, una por `(Concesión, Estación, Importe Original)` |

Ambos libros tienen las mismas **16 columnas**: `Tipo, Contrato, Tipo Tag, Tag Nº, Dominio, Concesion, FACTURA, Estación, Vía, Ascendente, Antena, Fecha, Importe Original, Descuento Aplicado, Descuento Importe, Importe Final`. La única diferencia entre los dos archivos es el orden relativo de `FACTURA` y `Estación`.

> **Ninguno de los dos libros tiene columna `CATEGORIA`.** Esto determina el tratamiento del dataset como Patrón A (ver §3).

### 2.2 El CSV de unión

| Propiedad | Valor verificado |
|---|---|
| Delimitador | `;` |
| Separador decimal | coma (`7148,39`) |
| Separador de miles | **ninguno** (`8935,49`, no `8.935,49`) |
| Codificación | **Windows-1252 / latin-1**, no UTF-8 — leído como UTF-8 los acentos se rompen |
| Filas de encabezado | 1 |
| Filas de datos | 119 |
| Columnas | 14 |

Encabezado exacto:

```text
Concesión;Estación;Importe Original;Casos;Importe Base (Estación);Multiplicador (Categoría estimada);Hora mín;Hora máx;Hora media;Desvío horario;Patrón horario;Muestra confiable (>=15);PATRON;STATUS
```

Primera y última fila de datos, literales:

```text
CORREDOR VIAL 5 S.A.U.;9 DE JULIO - RUTA 5 KM. 244;6000;4;6000;1;9;19;14,2;4,99;DISPERSO (todo el dia -> no es horario);FALSO;B;PENDIENTE
CORREDORES VIALES SA;ZARATE - RUTA 9 KM. 95;7500;189;1500;5;0;23;11,8;7,24;DISPERSO (todo el dia -> no es horario);VERDADERO;B;PICO
```

### 2.3 Distribuciones verificadas

| Columna | Distribución |
|---|---|
| `STATUS` | `NO_PICO` **52** · `PICO` **49** · `PENDIENTE` **18** (total 119) |
| `PATRON` | `B` **119** (valor único en todo el archivo) |
| `Patrón horario` | `DISPERSO (todo el dia -> no es horario)` **52** · `CONCENTRADO (posible horario)` **36** · `N/D (1 caso)` **31** |
| `Muestra confiable (>=15)` | `FALSO` **90** · `VERDADERO` **29** |
| `Concesión` | `CORREDORES VIALES SA` 64 · `RUTAS SUR ATLANTICO S.A.` 38 · `CORREDOR VIAL 5 S.A.U.` 16 · `CONEXION ALTO DELTA S.A.` 1 |

Cardinalidades:

| Clave | Distintos |
|---|---|
| `Estación` (nombre) | **34** |
| `(Concesión, Estación)` | **37** |
| `(Concesión, Estación, Importe Original)` | **119** (= una por fila; no hay duplicados) |
| `(Estación, Importe Original)` | **112** |
| `Importe Original` | **22** |

**Σ `Casos` = 1736.**

### 2.4 Cargas en DESARROLLO

Verificado el 2026-08-12 con una consulta de solo lectura sobre `kfffigvyvtzyczeiadxh`:

```sql
select file_upload_name, count(*) as pasadas, count(distinct estacion_id) as estaciones,
       min(fecha_hora) as desde, max(fecha_hora) as hasta,
       sum(case when precio < 0 then 1 else 0 end) as precios_negativos
from pasadas group by 1 order by 2 desc;
```

| `file_upload_name` | Pasadas | Estaciones | Rango `fecha_hora` | `precio < 0` |
|---|---|---|---|---|
| `ConsumosResumen.xlsx` | **1015** | 26 | 2026-07-01 08:22:12+00 → 2026-07-27 23:49:34+00 | 0 |
| `ConsumosResumen-202607-1.xlsx` | **696** | 30 | 2026-06-24 11:08:12+00 → 2026-07-12 23:08:11+00 | 0 |
| **Total de la épica** | **1711** | — | — | **0** |

> ⚠️ **No existe ningún `file_upload_name` que contenga la subcadena `202607-2`.** `202607-2` es solo el nombre de la **carpeta** donde vive el libro. La carga correspondiente está guardada como `ConsumosResumen.xlsx`, sin sufijo. Buscar por `202607-2` en `pasadas` devuelve cero filas y hace perder tiempo.

**Ítem de reconciliación 1040 → 1015 (localizado).** El libro
`ConsumosResumen.xlsx` tiene 1040 filas de datos y en DESARROLLO hay 1015
pasadas con ese `file_upload_name`: **faltan 25 filas (2,4 %)**. Refuerza que
la diferencia está en la carga y no en el CSV el hecho de que **Σ `Casos` del
CSV = 1736 = 1040 + 696 exactamente**, es decir que el CSV de unión se construyó
sobre los libros completos, sin la pérdida.

**Localización verificada el 2026-08-12:** las 25 filas faltan **todas** en
`ZARATE - RUTA 9 KM. 95` a precio 1500 (CSV 114 vs DB 89). El resto de niveles
de ZARATE coinciden (3000→20, 4500→35, 6000→355, 7500→189).
`scripts/telepeaje plus/202607-2/resumen.txt` dice
`Todas subidas menos 0104-00077675 NC`: evidencia fuerte (no prueba cerrada sin
abrir el xlsx) de que la NC `0104-00077675` nunca se cargó. Eso apoya filtrar
`documentos.tipo = 'FC'` y `precio > 0`, e **ignorar NCs en el MVP** (no restar
casos). Procedimiento de verificación residual en §8, paso 9; la decisión de
modelo está en Apéndice A §15.3.

Contexto adicional verificado en DESARROLLO el mismo día, que condiciona varias pruebas:

- **Todas** las pasadas de los dos libros pertenecen a documentos con `documentos.tipo = 'FC'`. No hay ninguna `NC` cargada todavía, y por eso `precio < 0` es **0** en toda la tabla. El caso de importes negativos es un riesgo **latente**, no un dato presente: hay que probarlo con datos sintéticos en el CLI local (caso `B-11`), no esperando encontrarlo en DESARROLLO.
- `pasadas` **todavía no tiene** las columnas `categoria`, `tarifa_normalizada_id` ni `tarifa_status`, y no existe ninguna tabla `tarifas_*`. Al 2026-08-12, F14-1 no está aplicada en DESARROLLO. Las columnas actuales son: `id, fecha_hora, pase_id, patente_id, estacion_id, documento_id, precio, bonificacion, quantity, importe_neto, created_at, user_id, file_upload_name`.

---

## 3. La inconsistencia PATRON A / B — pregunta abierta

**El hecho.** Las 119 filas del CSV tienen `PATRON = B`. Los dos libros de origen **no tienen columna `CATEGORIA`**. Según la regla de detección de Apéndice B, la ausencia de una columna de categoría en el archivo del proveedor es exactamente lo que define **Patrón A**.

**La lectura.** La etiqueta `B` del CSV no puede provenir del archivo: no hay de dónde sacarla. Lo que sí hay es la columna `Multiplicador (Categoría estimada)`, cuyo propio nombre dice que la categoría es **estimada**, derivada del cociente entre el importe y la tarifa base de la estación. Es decir: el CSV llama "Patrón B" a un análisis que *infiere* una categoría, no a un archivo que la *trae*.

**La decisión de testing.** Las pruebas tratan al dataset de referencia como **Patrón A**, con `categoria IS NULL` en todas las filas de `tarifas_normalizadas`. Consecuencias directas:

- La clave de familia debe funcionar con `categoria` nula en todas las filas ⇒ el caso `unique nulls not distinct` (`B-06`) no es un borde exótico sino **el caso normal** de este dataset.
- El filtro de categoría de la pantalla queda vacío y debe deshabilitarse con la ayuda correspondiente (Apéndice C §4).
- La columna `Patrón` de la tabla debe mostrar `A` para las 119 filas. Si muestra `B`, el bug está en la derivación del frontend, no en los datos.

**Pregunta abierta a resolver con el product owner antes de cerrar F14-6:**

> ¿La etiqueta `PATRON = B` del CSV de referencia significa (a) que el análisis usó un multiplicador estimado como sustituto de categoría, o (b) que se espera que estas concesiones envíen categoría en algún archivo que todavía no vimos? Si es (a), el CSV debería regenerarse con `PATRON = A` para no inducir a error. Si es (b), hay que identificar el archivo con categoría antes de fijar el comportamiento esperado.

Hasta que se responda, ninguna prueba debe afirmar `patron = 'B'` para este dataset.

---

## 4. Tabla de verdad numérica

### 4.1 Cómo se calculó cada cifra

Reproducible con cualquier script que lea el CSV. Todas las cifras de esta sección salen de estas reglas, aplicadas sobre `tarifa_test_resumen_union.csv` leído como **latin-1**, partido por `;` y con los decimales normalizados reemplazando `,` por `.`:

| Cifra | Columna de origen | Método |
|---|---|---|
| `niveles` | — | cantidad de filas del grupo |
| `casos` | `Casos` | suma de las filas del grupo |
| `importe mín` / `máx` | `Importe Original` | mínimo y máximo del grupo |
| `ratio` | `Importe Original` | `max / min`, **sin redondeo intermedio** |
| `multiplicador` | `Multiplicador (Categoría estimada)` | leído tal cual del archivo |
| `desvío` | `Desvío horario` | leído tal cual; celda vacía = sin dato |
| `patrón horario` | `Patrón horario` | valor literal |

**Agrupamiento.** La tabla de §4.2 agrupa por **nombre de estación** (34 grupos). Advertencia: tres nombres de estación aparecen bajo **dos concesiones distintas** — `9 DE JULIO - RUTA 5 KM. 244`, `OLIVERA - RUTA 5 KM. 86` y `TRENQUE LAUQUEN - RUTA 5 KM 429`, todas repartidas entre `CORREDOR VIAL 5 S.A.U.` y `CORREDORES VIALES SA`. Por eso hay 34 nombres pero 37 pares `(Concesión, Estación)`. En el modelo de la aplicación un `estacion_id` pertenece a exactamente un `peaje_id` vía `estaciones.peaje_id`, así que estos tres casos requieren decidir si son estaciones duplicadas en el catálogo o un problema de alias de proveedor (ver `B-13`).

### 4.2 Por estación (34 grupos, ordenados por cantidad de niveles)

| Estación | Concesión | Niveles | Casos | Importe mín | Importe máx | Ratio máx/mín |
|---|---|---:|---:|---:|---:|---:|
| AGÜERO - AU.RICCHIERI KM 15,80 | RUTAS SUR ATLANTICO S.A. | 17 | 102 | 774,41 | 8935,49 | **11,538449** |
| TRISTAN SUAREZ - AU. EZE-CAÑ KM 37,25 | RUTAS SUR ATLANTICO S.A. | 10 | 84 | 3097,65 | 8935,49 | 2,884603 |
| OLIVERA - RUTA 5 KM. 86 | CORREDOR VIAL 5 / CORREDORES VIALES | 10 | 63 | 1500 | 8935,49 | 5,956993 |
| TRENQUE LAUQUEN - RUTA 5 KM 429 | CORREDOR VIAL 5 / CORREDORES VIALES | 7 | 64 | 5361,29 | 8935,49 | 1,666668 |
| 9 DE JULIO - RUTA 5 KM. 244 | CORREDOR VIAL 5 / CORREDORES VIALES | 6 | 58 | 6000 | 8935,49 | 1,489248 |
| **ZARATE - RUTA 9 KM. 95** | CORREDORES VIALES SA | **5** | **713** | 1500 | 7500 | **5,000000** |
| LAGOS - RUTA 9 KM. 272 | CORREDORES VIALES SA | 5 | 178 | 1500 | 7500 | 5,000000 |
| LARENA - RUTA 8 KM 65 | CORREDORES VIALES SA | 4 | 106 | 1500 | 7500 | 5,000000 |
| COLONIA VICTORIA - RN 12 - Km 1551 | CORREDORES VIALES SA | 4 | 80 | 3000 | 7500 | **2,500000** |
| CARCARAÑA - AUTOVIA ROSARIO - CORDOBA KM. 356 | CORREDORES VIALES SA | 4 | 66 | 3000 | 7500 | **2,500000** |
| MONTE GRANDE - AU. EZE-CAÑ KM 32,70 DESC. | RUTAS SUR ATLANTICO S.A. | 4 | 9 | 1548,82 | 7744,12 | 5,000013 |
| JAMES CRAIK - AUTOVIA ROSARIO - CORDOBA KM. 595 | CORREDORES VIALES SA | 3 | 43 | 4500 | 7500 | 1,666667 |
| SANTA ANA - RN 12 - Km 1375 | CORREDORES VIALES SA | 3 | 39 | 4500 | 7500 | 1,666667 |
| SOLIS - RUTA 8 KM 102 | CORREDORES VIALES SA | 3 | 33 | 3000 | 7500 | **2,500000** |
| VILLA ESPIL - RUTA 7 KM. 88 | CORREDORES VIALES SA | 3 | 20 | 3000 | 7500 | **2,500000** |
| CAÑUELAS - RN 3 KM 76 | RUTAS SUR ATLANTICO S.A. | 3 | 5 | 4500 | 7148,39 | 1,588531 |
| JUNIN - RUTA 188 KM 152,20 | CORREDORES VIALES SA | 2 | 19 | 6000 | 7500 | 1,250000 |
| FRANCK - RUTA 19 KM 20 | CORREDORES VIALES SA | 2 | 11 | 6000 | 7500 | 1,250000 |
| JUNIN (R7) - RUTA 7 KM. 272 | CORREDORES VIALES SA | 2 | 8 | 4500 | 7500 | 1,666667 |
| DEVOTO - RUTA 19 KM 142 | CORREDORES VIALES SA | 2 | 5 | 6000 | 7500 | 1,250000 |
| SAN VICENTE - RUTA 34 KM 160 | CORREDORES VIALES SA | 2 | 5 | 6000 | 7500 | 1,250000 |
| ITUZAINGO - RN 12 - Km 1262 | CORREDORES VIALES SA | 2 | 3 | 6000 | 7500 | 1,250000 |
| MAKALLE - RN 16 - Km 59.80 | CORREDORES VIALES SA | 2 | 3 | 6000 | 7500 | 1,250000 |
| PUENTE GRAL. BELGRANO - RN 16 - Km 5.00 | CORREDORES VIALES SA | 2 | 3 | 6000 | 7500 | 1,250000 |
| V. TUERTO (RN8) - RUTA 8 KM 381 | CORREDORES VIALES SA | 2 | 3 | 6000 | 7500 | 1,250000 |
| EZEIZA - AU. EZE-CAÑ KM 32,40 ASC. | RUTAS SUR ATLANTICO S.A. | 2 | 2 | 6195,3 | 7744,12 | 1,249999 |
| URIBELARREA - RN 205 KM 83 | RUTAS SUR ATLANTICO S.A. | 1 | 3 | 5361,29 | 5361,29 | 1,000000 |
| ISLA LA DESEADA - RUTA 174 KM 5,2 | CONEXION ALTO DELTA S.A. | 1 | 2 | 5219,58 | 5219,58 | 1,000000 |
| CAÑUELAS - RUTA 3 KM. 76 | CORREDORES VIALES SA | 1 | 1 | 6000 | 6000 | 1,000000 |
| CERES - RUTA 34 KM 378 | CORREDORES VIALES SA | 1 | 1 | 6000 | 6000 | 1,000000 |
| HINOJO - RN 226 KM 276 | RUTAS SUR ATLANTICO S.A. | 1 | 1 | 7500 | 7500 | 1,000000 |
| HINOJO - RUTA 226 KM. 276 | CORREDORES VIALES SA | 1 | 1 | 4500 | 4500 | 1,000000 |
| SAMPACHO - RUTA 8 KM 655 | CORREDORES VIALES SA | 1 | 1 | 6000 | 6000 | 1,000000 |
| URIBELARREA - RUTA 205 KM. 83 | CORREDORES VIALES SA | 1 | 1 | 7500 | 7500 | 1,000000 |

Distribución de niveles por estación: 1→8 estaciones, 2→10, 3→5, 4→4, 5→2, 6→1, 7→1, 10→2, 17→1. **8 estaciones de un solo nivel** (candidatas a `TARIFA_UNICA`), **26 con dos o más**.

### 4.3 ZARATE - RUTA 9 KM. 95 — familia de referencia principal

Los cinco niveles, tal como están en el CSV:

| Importe | Casos | Base | Multiplicador | Hora mín | Hora máx | Hora media | Desvío | Patrón horario | Muestra confiable | STATUS |
|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| 1500 | 114 | 1500 | 1 | 0 | 23 | 13,5 | 7,49 | DISPERSO | VERDADERO | **NO_PICO** |
| 3000 | 20 | 1500 | 2 | 3 | 21 | 14,6 | 4,73 | DISPERSO | VERDADERO | **PICO** |
| 4500 | 35 | 1500 | 3 | 0 | 23 | 13,7 | 6,4 | DISPERSO | VERDADERO | **PICO** |
| 6000 | 355 | 1500 | 4 | 0 | 23 | 13,1 | 5,98 | DISPERSO | VERDADERO | **PICO** |
| 7500 | 189 | 1500 | 5 | 0 | 23 | 11,8 | 7,24 | DISPERSO | VERDADERO | **PICO** |

Σ casos **713** en el CSV (en DB hoy: **688** = 713 − 25 del hueco ZARATE-1500),
ratio **5,0**, los cinco niveles con muestra confiable y los cinco `DISPERSO`.
Es el caso ideal para la regla de sugerencia ascendente de Apéndice C §7.2: el
nivel más barato es `NO_PICO` y los cuatro restantes `PICO`, exactamente lo que
la regla produce. Se usa como aserción exacta en `F-02` y `S-02` **sobre los
números del CSV**; al contrastar contra DESARROLLO hay que esperar 89 casos en
1500, no 114.

También es el caso didáctico opuesto: cinco niveles todos dispersos con
multiplicador 1×→5× es la firma de una **variación por categoría**, no de un
horario. Sirve para probar la acción `Es variación por categoría`.

### 4.3.1 Prueba empírica UTC vs Buenos Aires (ZARATE)

Verificado en DESARROLLO el 2026-08-12. `Desvío horario` del CSV vs
`stddev_pop` recalculado con `AT TIME ZONE 'UTC'` y con
`AT TIME ZONE 'America/Argentina/Buenos_Aires'`:

| Importe | Casos DB | Desvío CSV | Desvío UTC | Desvío BA |
|---|---:|---:|---:|---:|
| 1500 | 89 (CSV 114) | 7,49 | 7,02 | 6,95 |
| 3000 | 20 | 4,73 | 4,74 | 4,74 |
| 4500 | 35 | 6,40 | 6,35 | 5,27 |
| 6000 | 355 | 5,98 | 5,99 | 5,84 |
| 7500 | 189 | 7,24 | 7,25 | 6,95 |

**4/5 niveles coinciden con UTC ±0,01.** Usar `America/Argentina/Buenos_Aires`
desplaza el pico del mediodía a una falsa hora pico de 7–8 a. m. (bug silencioso).
La extracción **debe** pinnear `AT TIME ZONE 'UTC'` (Apéndice A §15.2). Caso de
prueba: `B-12`. Si la ingesta del wizard algún día guarda offsets reales,
revisar esta decisión.

### 4.4 AGÜERO - AU.RICCHIERI KM 15,80 — familia extrema

17 niveles, 102 casos, base 774,41, ratio **11,538449** (el más alto del dataset). Distribución de STATUS dentro de la familia: `PICO` 8 · `NO_PICO` 7 · `PENDIENTE` 2. Los 17 niveles:

| Importe | Casos | Mult. | Hora mín | Hora máx | Hora media | Desvío | Patrón horario | STATUS |
|---:|---:|---:|---:|---:|---:|---:|---|---|
| 774,41 | 2 | 1 | 13 | 14 | 13,5 | 0,71 | CONCENTRADO | PICO |
| 893,55 | 2 | 1,154 | 17 | 19 | 18 | 1,41 | CONCENTRADO | PICO |
| 1300 | 1 | 1,679 | 13 | 13 | 13 | *(vacío)* | N/D (1 caso) | PICO |
| 1548,82 | 19 | 2 | 0 | 23 | 10,8 | 7,21 | DISPERSO | NO_PICO |
| 1787,1 | 5 | 2,308 | 9 | 20 | 15 | 4,18 | DISPERSO | NO_PICO |
| 3097,65 | 25 | 4 | 4 | 23 | 12,7 | 6,96 | DISPERSO | NO_PICO |
| 3574,19 | 11 | 4,615 | 8 | 19 | 11,8 | 3,66 | CONCENTRADO | **PENDIENTE** |
| 3900 | 1 | 5,036 | 2 | 2 | 2 | *(vacío)* | N/D (1 caso) | **PENDIENTE** |
| 4646,47 | 4 | 6 | 5 | 14 | 10,8 | 4,03 | CONCENTRADO | PICO |
| 5200 | 1 | 6,715 | 4 | 4 | 4 | *(vacío)* | N/D (1 caso) | NO_PICO |
| 6000 | 2 | 7,748 | 18 | 19 | 18,5 | 0,71 | CONCENTRADO | NO_PICO |
| 6195,3 | 7 | 8 | 4 | 23 | 14 | 7,64 | DISPERSO | PICO |
| 6500 | 2 | 8,393 | 21 | 22 | 21,5 | 0,71 | CONCENTRADO | PICO |
| 7148,39 | 3 | 9,231 | 9 | 17 | 14 | 4,36 | DISPERSO | PICO |
| 7500 | 1 | 9,685 | 10 | 10 | 10 | *(vacío)* | N/D (1 caso) | PICO |
| 7744,12 | 15 | 10 | 1 | 23 | 10,4 | 6,13 | DISPERSO | NO_PICO |
| 8935,49 | 1 | 11,538 | 16 | 16 | 16 | *(vacío)* | N/D (1 caso) | NO_PICO |

Es el contraejemplo de la regla de sugerencia: los `PICO` y `NO_PICO` están intercalados, sin correlación monótona con el precio. **Ninguna regla automática ordenada por precio puede reproducir esta familia**, y por eso la sugerencia de Apéndice C §7.2 se declara editable y no se afirma como correcta. Se usa en `F-03` (render de 17 niveles sin componente distinto) y en `S-03` (la sugerencia no coincide con el esperado y el humano corrige).

### 4.5 Grupo de ratio 2,5

Cuatro estaciones, todas de `CORREDORES VIALES SA`, todas con importes entre 3000 y 7500:

| Estación | Niveles | Casos |
|---|---:|---:|
| COLONIA VICTORIA - RN 12 - Km 1551 | 4 | 80 |
| CARCARAÑA - AUTOVIA ROSARIO - CORDOBA KM. 356 | 4 | 66 |
| SOLIS - RUTA 8 KM 102 | 3 | 33 |
| VILLA ESPIL - RUTA 7 KM. 88 | 3 | 20 |

Es el conjunto de prueba de `peajes_grupos_similares_tarifa`: cuatro familias con **ratio idéntico** pero **distinta cantidad de niveles** (dos con 4 y dos con 3). Exactamente el escenario que la limitación de comparación por dos extremos no distingue, y que la pantalla debe advertir (Apéndice C §8.3). Caso `B-14` y `F-09`.

### 4.6 Estaciones de un nivel

Las 8 estaciones de un solo nivel tienen ratio **1,000000** y son las candidatas naturales a `diagnostico = TARIFA_UNICA`:

| Estación | Casos | Importe | STATUS |
|---|---:|---:|---|
| URIBELARREA - RN 205 KM 83 | 3 | 5361,29 | NO_PICO |
| ISLA LA DESEADA - RUTA 174 KM 5,2 | 2 | 5219,58 | NO_PICO |
| CAÑUELAS - RUTA 3 KM. 76 | 1 | 6000 | PICO |
| CERES - RUTA 34 KM 378 | 1 | 6000 | PICO |
| HINOJO - RN 226 KM 276 | 1 | 7500 | PICO |
| HINOJO - RUTA 226 KM. 276 | 1 | 4500 | NO_PICO |
| SAMPACHO - RUTA 8 KM 655 | 1 | 6000 | NO_PICO |
| URIBELARREA - RUTA 205 KM. 83 | 1 | 7500 | NO_PICO |

Notar que `URIBELARREA` y `HINOJO` aparecen **dos veces cada una, con nombres distintos** (`RN 205` vs `RUTA 205`, `RN 226` vs `RUTA 226`) y bajo concesiones distintas. Son casos reales de alias de estación no unificados y hay que decidir si se normalizan antes de generar familias (ver `B-13`).

### 4.7 Reglas derivadas verificadas

Tres relaciones que se cumplen en el 100 % de las filas y que sirven como aserciones exactas del cálculo de familias:

| Regla | Verificación |
|---|---|
| `Importe Base (Estación)` = **mínimo** `Importe Original` de la estación | **34 de 34** estaciones cumplen; 0 anomalías |
| `Multiplicador (Categoría estimada)` = `round(Importe Original / Importe Base, 3)` | **0 de 119** filas discrepan |
| Umbral de muestra confiable = **`Casos >= 15`** | mínimo `Casos` entre las `VERDADERO` = **15**; máximo entre las `FALSO` = **14**. El corte es exacto y sin ambigüedad |

Y una que **no** se puede recuperar del archivo:

| Regla | Estado |
|---|---|
| Corte `CONCENTRADO` / `DISPERSO` sobre `Desvío horario` | El máximo desvío de una fila `CONCENTRADO` es **4,15**; el mínimo de una `DISPERSO` es **4,18**. El umbral está en el intervalo abierto (4,15 · 4,18], pero **el valor exacto no es recuperable del CSV**. La amplitud `Hora máx − Hora mín` no sirve como criterio alternativo: se superpone (CONCENTRADO va de 0 a 15 h de amplitud, DISPERSO de 8 a 23 h). **Apéndice A debe fijar el umbral explícitamente**; las pruebas usan el valor que fije Apéndice A y verifican la clasificación de las filas frontera (`AGÜERO` 3574,19 con desvío 3,66 debe caer en concentrado; `AGÜERO` 1787,1 con desvío 4,18 debe caer en disperso). |

### 4.8 Cifras que no se pudieron reproducir

Se documentan en lugar de repetirse:

1. **«`Patrón horario` tiene 3 valores, uno de ellos `N/D` con 1 fila».** El tercer valor literal es **`N/D (1 caso)`** y aparece en **31 filas**, no en 1. Coincide exactamente con las 31 filas que tienen `Casos = 1` y con las 31 que tienen `Desvío horario` vacío. La confusión probablemente viene de leer «(1 caso)» como si fuera el recuento de filas: es parte de la etiqueta.
2. **«Muchas estaciones de un solo nivel tienen ratio 1.0 y stddev 0».** El ratio 1,0 se confirma para las 8. El «stddev 0» **no**: `Desvío horario` es la dispersión **horaria** dentro del nivel, no la dispersión de precios, y para esas 8 estaciones no es cero (por ejemplo `URIBELARREA - RN 205 KM 83`, con 3 casos, está clasificada `DISPERSO`). Las únicas celdas de desvío **vacías** son las 31 filas de `Casos = 1`. Existe además exactamente una fila con desvío **0** que no es de un solo caso: `OLIVERA - RUTA 5 KM. 86` en 1500, con 2 casos a la misma hora.
3. **«`MONTE GRANDE` tiene ratio 5,0».** El valor recalculado es **5,000013** (1548,82 → 7744,12). La diferencia importa si una prueba compara ratios por igualdad exacta: hay que comparar con tolerancia.

### 4.9 Hallazgo que cambia una prueba de Apéndice A

Las 31 filas con `Casos = 1` tienen `Desvío horario` **vacío**, no `0`. En Postgres:

- `stddev_pop` sobre una sola fila devuelve **`0`**;
- `stddev_samp` (y `stddev`, que es su alias) sobre una sola fila devuelve **`NULL`**.

La celda vacía del CSV corresponde a `NULL`, así que **el análisis de referencia usó desviación muestral**, no poblacional. Si Apéndice A especifica `stddev_pop`, el resultado del motor diferirá del CSV en esas 31 filas: donde el CSV dice «sin dato» el motor dirá «dispersión 0», que además es el valor que más se parece a «concentradísimo» y podría empujar esas filas a `POSIBLE_HORARIO` incorrectamente. **Decisión requerida antes de escribir `B-05`:** o el motor usa `stddev_samp` y trata `NULL` como «sin dato» ⇒ `MUESTRA_INSUFICIENTE`, o usa `stddev_pop` y **además** excluye explícitamente los casos con `casos = 1` de la evaluación horaria. Las dos son defendibles; lo que no es defendible es dejar que un caso único parezca la evidencia más fuerte del dataset.

---

## 5. Casos de prueba backend (pgTAP · Supabase CLI local)

Archivo sugerido: `ibarra-app/supabase/tests/peajes_f14_test.sql`. Todos corren con `npx supabase db reset --local --no-seed` previo.

| id | Objetivo | Setup | Acción | Resultado esperado |
|---|---|---|---|---|
| **B-01** | `MUESTRA_INSUFICIENTE` por debajo del umbral | `tarifas_parametros_peaje.umbral_muestra_minima = 15`; una familia con un nivel de 14 pasadas | Ejecutar el cálculo de familias del peaje | `diagnostico = 'MUESTRA_INSUFICIENTE'`. Con 15 pasadas y el resto igual, el diagnóstico ya **no** es `MUESTRA_INSUFICIENTE` (el corte `>= 15` está verificado en §4.7) |
| **B-02** | `TARIFA_UNICA` con un solo nivel | Estación con 40 pasadas, todas a 5361,29 (caso `URIBELARREA - RN 205 KM 83` ampliado) | Ídem | Una sola fila en `tarifas_normalizadas`, `multiplicador = 1`, `diagnostico = 'TARIFA_UNICA'`; no se evalúa dispersión horaria |
| **B-03** | `CATEGORIA` en Patrón A con dispersión alta | Familia `ZARATE`: 5 niveles 1500/3000/4500/6000/7500, casos 114/20/35/355/189, horas repartidas 0–23 en los cinco, `categoria IS NULL` | Ídem | Los 5 niveles con `diagnostico = 'CATEGORIA'`; `importe_base = 1500`; multiplicadores 1/2/3/4/5 exactos |
| **B-04** | `POSIBLE_HORARIO` con dispersión baja | Familia de 2 niveles: base con horas 0–23 y nivel caro concentrado entre 17 y 19 h, ambos con `casos >= 15` | Ídem | El nivel caro con `diagnostico = 'POSIBLE_HORARIO'`; usar el umbral que fije Apéndice A y verificar además las filas frontera de §4.7 |
| **B-05** | Borde de `stddev` con una sola pasada | Un nivel con exactamente **1** pasada | Ídem | Según lo que se resuelva en §4.9: `desvio_horario IS NULL` y `diagnostico = 'MUESTRA_INSUFICIENTE'`. **En ningún caso** `desvio_horario = 0` con `diagnostico = 'POSIBLE_HORARIO'` |
| **B-06** | `unique nulls not distinct` con `categoria IS NULL` | Dos filas Patrón A de la misma estación y el **mismo** importe, ambas con `categoria = NULL` | `insert` de la segunda | Violación de unicidad. Sin `nulls not distinct` Postgres las considera distintas y se duplica la familia — que es el caso normal de este dataset, no un borde |
| **B-07** | Trigger rechaza status fuera del catálogo | `tarifas_status_catalogo` del peaje con `PICO` y `NO_PICO` | `peajes_confirmar_status_tarifa` con `status = 'PICO_MANANA'` | Error; ninguna fila modificada; la transacción completa revierte (no debe quedar la mitad de un lote aplicada) |
| **B-08** | Trigger acepta los universales | Ídem, con `PENDIENTE` y con `POSIBLE_HORARIO` | Dos llamadas | Ambas aceptadas aunque no estén en `tarifas_status_catalogo` del peaje |
| **B-09** | `confirmado_manual` protege la clasificación humana | Familia clasificada a mano (`status = 'PICO'`, `confirmado_manual = true`) y otra sin confirmar | `peajes_recalcular_tarifas(p_peaje_id)` | La confirmada conserva `status` y `confirmado_manual`; la no confirmada se recalcula. **Si el comportamiento real fuera otro, hay que corregir el copy del diálogo de Recalcular (Apéndice C §11), no la prueba** |
| **B-10** | Idempotencia sobre el mismo `documento_id` | Un documento ya normalizado | Ejecutar `peajes_normalizar_tarifas` una segunda vez sobre el mismo `documento_id` | Misma cantidad de filas en `tarifas_normalizadas`, mismos `id`, mismos `casos`. No se duplica ni se reinicia `status` |
| **B-11** | `precio` negativo de notas de crédito | Insertar pasadas con `documentos.tipo = 'NC'` y `precio < 0` sobre una estación que ya tiene familias | Recalcular | Las pasadas de importe negativo **no** generan nivel de tarifa ni alteran `importe_base` ni restan `cases`. **MVP: ignorar NCs** (Apéndice A §15.3). **Debe probarse con datos sintéticos en el CLI local**: en DESARROLLO no hay ninguna `NC` ni ningún `precio < 0` (§2.4); el hueco ZARATE-1500 se explica por una NC **no cargada** (`0104-00077675`), no por una NC presente en base |
| **B-12** | Zona horaria de la extracción de hora — pin UTC | Familia `ZARATE` con las pasadas reales de DESARROLLO; calcular `desvio` con `AT TIME ZONE 'UTC'` y con `America/Argentina/Buenos_Aires` | Recalcular / query de verificación | Los desvíos UTC deben coincidir con §4.3.1 (±0,01 en 4/5 niveles). Con BA el nivel 4500 se desvía ~1 h y aparece un falso pico matutino. Además, una pasada sintética `'2026-07-01T02:30:00Z'` debe dar `hora_min = hora_max = 2` **con cualquier `TimeZone` de sesión**, porque la expresión pinnea UTC. Sin el pin, en ART daría 23 del día anterior |
| **B-13** | Estaciones homónimas bajo dos concesiones | Dos `estaciones` con el mismo nombre y distinto `peaje_id` (caso real: `9 DE JULIO - RUTA 5 KM. 244`) | Calcular familias | Dos familias separadas, una por `peaje_id`; `importe_base` calculado por familia y no mezclado. Ver §4.1 |
| **B-14** | Grupos similares con distinta cantidad de niveles | Las cuatro familias de ratio 2,5 de §4.5 | `peajes_grupos_similares_tarifa(<id de SOLIS>, 0.05)` | Devuelve las otras tres pese a que dos tienen 4 niveles y una tiene 3. La prueba **documenta** la limitación, no la considera un fallo |
| **B-15** | Propagación de `status` a `pasadas` | Familia `ZARATE` 6000 con 355 pasadas asociadas | `peajes_confirmar_status_tarifa` con `status = 'PICO'` | Las 355 pasadas quedan con `tarifa_status = 'PICO'` y `tarifa_normalizada_id` apuntando a la familia. Ninguna pasada de otro nivel se toca |
| **B-16** | Reversión de una asignación | Familia ya confirmada como `PICO` | Confirmar de nuevo con `NO_PICO` | `status` y `pasadas.tarifa_status` pasan a `NO_PICO`; no se duplican filas; `confirmado_manual` sigue en `true` |

---

## 6. Casos de prueba frontend (Karma + Jasmine)

**Precedente a imitar.** `pasadas-pendientes-list.component.spec.ts` **no existe**: la lista más parecida a esta pantalla no tiene spec. El modelo más cercano disponible es `estacion-ubicacion-drawer.component.spec.ts`, que es breve y directo — `TestBed.configureTestingModule({ imports: [Componente] })`, asignación de `@Input()` a mano, `fixture.detectChanges()` y aserciones sobre el estado del componente y sobre emisiones de `@Output()`:

```25:34:ibarra-app/src/app/components/peajes/pasadas-pendientes/estacion-ubicacion-drawer.component.spec.ts
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstacionUbicacionDrawerComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(EstacionUbicacionDrawerComponent);
    component = fixture.componentInstance;
    component.open = true;
    component.group = group;
    fixture.detectChanges();
  });
```

Los componentes hoja (`tarifa-status-buttons`, `tarifa-status-badge`, `tarifa-familia-panel`, `tarifa-comparar-dialog`) se prueban así, sin providers. El contenedor `auditoria-tarifas-list` necesita además el token del servicio, provisto con el mock tipado:

```ts
providers: [{ provide: PEAJES_AUDITORIA_TARIFAS_SERVICE, useClass: AuditoriaTarifasMockService }]
```

Otros specs de referencia por estilo: `plantillas/motor.spec.ts` (aserciones numéricas exactas) y `wizard/services/column-recognition.spec.ts`.

### 6.1 `tarifa-status-buttons.component.spec.ts`

| id | `it(...)` | Aserción |
|---|---|---|
| F-01 | `renderiza un botón por cada código del catálogo, ordenado por orden` | Con `[{ NO_PICO, orden: 1 }, { PICO, orden: 2 }]` hay 2 botones, el primero dice `No pico`; con un catálogo de 3 códigos hay 3 botones sin cambiar de componente |
| F-02 | `no renderiza PENDIENTE como botón` | Ningún botón tiene el texto `Pendiente`; con `status = 'PENDIENTE'` ningún botón está `aria-checked="true"` y se ve el texto `Sin clasificar` |
| F-03 | `aplica etiqueta y color del catálogo` | El botón usa `etiqueta`, no el `codigo`; el color entra como custom property y no como clase con el código |
| F-04 | `expone role="radiogroup" y aria-checked` | El contenedor tiene `role="radiogroup"`; exactamente un hijo con `aria-checked="true"` cuando hay selección |
| F-05 | `ArrowRight mueve y selecciona el siguiente código` | Tras `keydown ArrowRight`, `aria-checked` se mueve al siguiente y se emite el cambio |
| F-06 | `roving tabindex deja un solo botón tabulable` | Exactamente un botón con `tabindex="0"` |

### 6.2 `tarifa-familia-panel.component.spec.ts`

| id | `it(...)` | Aserción |
|---|---|---|
| F-07 | `sugiere por precio ascendente usando orden del catálogo` | Con la familia `ZARATE` de §4.3 y el catálogo `NO_PICO(1) / PICO(2)`, la sugerencia es exactamente `[NO_PICO, PICO, PICO, PICO, PICO]` para los importes 1500/3000/4500/6000/7500 |
| F-08 | `no sugiere nada para niveles con MUESTRA_INSUFICIENTE` | Ese nivel queda sin selección y no entra en `p_asignaciones` |
| F-09 | `renderiza 17 niveles sin componente alternativo` | Con la familia `AGÜERO` de §4.4 hay 17 filas y 17 grupos de botones, mismo componente hijo |
| F-10 | `arma p_asignaciones con todos los niveles seleccionados` | El arreglo emitido tiene 5 entradas con las claves `tarifa_normalizada_id` y `status_codigo`, y ninguna entrada con `PENDIENTE` |
| F-11 | `excluye del arreglo los niveles sin seleccionar` | Con 5 niveles y 2 sin selección, el arreglo tiene 3 entradas |
| F-12 | `emite CATEGORIA y REVISAR desde las acciones secundarias` | `Es variación por categoría` emite `'CATEGORIA'`; `Marcar para revisar` emite `'REVISAR'` |
| F-13 | `mantiene la selección local si la confirmación falla` | Con el servicio devolviendo error, la selección sigue puesta y se muestra el mensaje de error |
| F-14 | `deshabilita los botones mientras confirma` | Con `saving = true`, todos los botones de status tienen `disabled`, y ninguno desaparece del DOM |

### 6.3 `tarifa-status-badge.component.spec.ts`

| id | `it(...)` | Aserción |
|---|---|---|
| F-15 | `resuelve etiqueta y color desde el catálogo` | Código `PICO` con catálogo cargado → texto `Pico` |
| F-16 | `muestra el código crudo en gris si es desconocido` | Código `PICO_MANANA` con el catálogo de 2 entradas → el texto renderizado es `PICO_MANANA`, con la clase neutra y sin excepción |
| F-17 | `no rompe con el catálogo vacío` | `catalogo = []` → renderiza el código crudo, `aria-busy="true"`, sin error |
| F-18 | `trata PENDIENTE y null como Sin clasificar` | Ambos casos → texto `Sin clasificar`, tono ámbar |

### 6.4 `auditoria-tarifas-list.component.spec.ts`

| id | `it(...)` | Aserción |
|---|---|---|
| F-19 | `aplica debounce de 300 ms a los cambios de filtro` | Con `fakeAsync`: tres `patchFilters` seguidos + `tick(300)` ⇒ **una** sola llamada a `listar` |
| F-20 | `resetea la página al filtrar` | Con `page = 3`, un cambio de filtro deja `page = 1` |
| F-21 | `abre una sola fila a la vez` | Expandir A y luego B deja `expandedId === B` y un solo `tr.at__detail` en el DOM |
| F-22 | `colapsa si la fila abierta desaparece del listado` | Tras recargar con un resultado que no contiene `expandedId`, queda en `null` |
| F-23 | `refleja aria-expanded en el expander` | `false` cerrado, `true` abierto |
| F-24 | `muestra el mensaje de vacío con filtros` | Servicio devuelve `rows: []` con filtros activos → texto `No hay familias de tarifa con estos filtros.` |
| F-25 | `muestra el mensaje de error con role="alert"` | Servicio rechaza → `No se pudieron cargar las familias de tarifa. Reintentá o quitá filtros.` dentro de un `[role=alert]` |
| F-26 | `deshabilita Recalcular sin un peaje único` | Sin filtro de peaje o con dos peajes → botón `disabled` |
| F-27 | `deshabilita el filtro de categoría en Patrón A` | Con `listarCategorias` devolviendo `[]` → control `disabled` y ayuda `Este peaje no informa categoría (Patrón A).` |
| F-28 | `ordena por cases desc al iniciar` | Primera llamada a `listar` con `sort: 'cases:desc'` |

### 6.5 `tarifa-comparar-dialog.component.spec.ts`

| id | `it(...)` | Aserción |
|---|---|---|
| F-29 | `expone role="dialog" y aria-modal="true"` | Presentes en el panel al abrir |
| F-30 | `mueve el foco al abrir y lo restaura al cerrar` | El foco entra al primer control; al cerrar vuelve al botón que abrió el diálogo |
| F-31 | `atrapa el foco con Tab` | `Tab` desde el último enfocable vuelve al primero |
| F-32 | `cierra con Escape` | `keydown Escape` emite `closed` |
| F-33 | `muestra la advertencia de comparación por dos niveles` | El texto de la limitación está en el DOM cuando hay al menos un grupo similar |
| F-34 | `deja desmarcadas las familias con distinta cantidad de niveles` | Con `SOLIS` (3 niveles) como origen y `CARCARAÑA` (4 niveles) entre los similares, esa casilla arranca sin marcar |

---

## 7. Prueba del input de usuario (STATUS)

El usuario fue explícito: **la única columna que carga una persona es `STATUS`**. Merece su propio grupo de pruebas, separado del resto, porque es donde se juega el valor de toda la épica.

### 7.1 Qué es algorítmico y qué es humano

Distinción que hay que sostener en las aserciones, porque mezclarla lleva a probar el algoritmo creyendo que se prueba la UI:

| Etapa | Quién | Salida |
|---|---|---|
| Detectar niveles de tarifa y calcular `multiplicador`, `desvio_horario`, `muestra_confiable` | algoritmo (SQL) | filas de `tarifas_normalizadas` |
| Asignar `diagnostico` | algoritmo (SQL) | `MUESTRA_INSUFICIENTE` / `TARIFA_UNICA` / `CATEGORIA` / `POSIBLE_HORARIO` |
| **Preclasificar** `status` por precio ascendente | algoritmo (frontend, Apéndice C §7.2) | **propuesta no persistida** |
| **Confirmar** `status` | **persona** | `peajes_confirmar_status_tarifa` ⇒ `tarifas_normalizadas.status` + `pasadas.tarifa_status` |
| Forzar `diagnostico` a `CATEGORIA` o `REVISAR` | **persona** | `peajes_marcar_diagnostico_tarifa` |

La preclasificación es una comodidad, no una verdad. Ninguna prueba debe afirmar que la preclasificación *es* la clasificación correcta.

### 7.2 Estado final esperado

El dataset de referencia ya está clasificado, y esa clasificación es el estado final esperado de la pantalla una vez que el analista terminó:

| `status` | Filas | Proporción |
|---|---:|---:|
| `NO_PICO` | 52 | 43,7 % |
| `PICO` | 49 | 41,2 % |
| `PENDIENTE` | 18 | 15,1 % |
| **Total** | **119** | 100 % |

Las 18 `PENDIENTE` **no son un error**: son las familias que el analista decidió no clasificar, y hay que tratarlas como parte del resultado esperado. De ellas, 14 tienen `Casos < 15` (muestra no confiable) y 4 tienen muestra confiable — es decir, el analista dejó pendientes también casos con datos suficientes, lo que confirma que `PENDIENTE` es una decisión y no solo una consecuencia de falta de datos.

### 7.3 Casos

| id | Nivel | Objetivo | Aserción |
|---|---|---|---|
| **S-01** | verify offline | La preclasificación completa del dataset | Correr el clasificador puro sobre las 119 filas del CSV y **reportar** cuántas coinciden con la columna `STATUS`. Es una métrica de calidad de la sugerencia, no un umbral de fallo: la prueba imprime el número y falla solo si el script rompe |
| **S-02** | verify offline | La sugerencia acierta en la familia canónica | En `ZARATE - RUTA 9 KM. 95` la propuesta es exactamente `NO_PICO, PICO, PICO, PICO, PICO` para 1500/3000/4500/6000/7500 — **coincidencia 5 de 5** con la columna `STATUS` |
| **S-03** | verify offline | La sugerencia **no** acierta en la familia extrema | En `AGÜERO - AU.RICCHIERI KM 15,80` la propuesta difiere del `STATUS` esperado. La prueba **afirma que difiere**, para que quede documentado que la corrección humana es indispensable y no una eventualidad |
| **S-04** | Karma | Un toque cambia la selección | Un `click` en un botón de status deja ese código seleccionado y quita la selección anterior, sin llamar al servicio |
| **S-05** | Karma | Confirmar es lo único que persiste | Tras N toques, el servicio recibe **una** llamada a `confirmarStatus`, con un arreglo de N entradas |
| **S-06** | Karma | La distribución final se alcanza clasificando | Sembrar el mock con las 119 familias en `PENDIENTE`, aplicar por cada familia el `STATUS` del CSV mediante la interacción de botones, y verificar que el estado acumulado del mock es exactamente **`NO_PICO` 52 / `PICO` 49 / `PENDIENTE` 18** |
| **S-07** | pgTAP | La confirmación llega hasta `pasadas` | Ver `B-15` |
| **S-08** | pgTAP | Un `status` inventado se rechaza | Ver `B-07` |
| **S-09** | manual | El estado final se ve en DESARROLLO | Ver §8, paso 7 |

El script de verificación offline vive en `ibarra-app/src/app/components/peajes/auditoria-tarifas/clasificacion.verify.ts` y sigue el patrón de `plantillas/motor.verify.ts` y `e2e-prd21.verify.ts`: **fábrica plana, sin DI de Angular y sin Karma**, ejecutable con `npx --yes tsx`. Lee el CSV con codificación latin-1 (§2.2).

---

## 8. E2E manual contra DESARROLLO

Procedimiento ordenado. **Solo lectura salvo el paso 2.** Cruzar con la skill `.agents/skills/verification-pasadas-files/SKILL.md`, que define el flujo de reconciliación archivo ↔ `pasadas` y sus reglas de seguridad (nada de `UPDATE`/`DELETE`, nada de `db push`, confirmar el ref del proyecto antes de cualquier consulta remota).

```text
- [ ]  1. Confirmar que el proyecto vinculado es DESARROLLO (kfffigvyvtzyczeiadxh) y ninguno de los refs prohibidos
- [ ]  2. Cargar 'scripts/telepeaje plus/202607-1/ConsumosResumen-202607-1.xlsx' por el asistente (/peajes/wizard)
- [ ]  3. Verificar que el hook post-guardado generó familias para ese peaje
- [ ]  4. Inspeccionar las familias generadas y compararlas con §4.2
- [ ]  5. Abrir /peajes/auditoria-tarifas y verificar filtros, tabla y escalera
- [ ]  6. Clasificar una familia completa con los botones y confirmar
- [ ]  7. Verificar la propagación a pasadas.tarifa_status
- [ ]  8. Verificar las vistas de Power BI
- [ ]  9. Reconciliar 1040 vs 1015 en ConsumosResumen.xlsx
- [ ] 10. Registrar evidencia en feature_list.json y docs/claude-progress.md
```

### Consultas de verificación (todas `SELECT`)

**Paso 3 — el hook corrió:**

```sql
select count(*) as familias,
       count(*) filter (where status = 'PENDIENTE') as pendientes,
       count(distinct estacion_id) as estaciones
from tarifas_normalizadas tn
join estaciones e on e.id = tn.estacion_id
where e.peaje_id = '<PEAJE_ID>';
```

**Paso 4 — familias generadas vs. la tabla de verdad:**

```sql
select e.nombre as estacion,
       count(*) as niveles,
       sum(tn.cases) as cases,
       min(tn.importe) as importe_min,
       max(tn.importe) as importe_max,
       round(max(tn.importe) / nullif(min(tn.importe), 0), 6) as ratio
from tarifas_normalizadas tn
join estaciones e on e.id = tn.estacion_id
where e.peaje_id = '<PEAJE_ID>'
group by 1
order by 2 desc, 3 desc;
```

Contrastar con §4.2. Diferencias esperadas y aceptables: el libro `202607-1` es solo una parte de la unión, así que los `cases` serán menores; lo que **debe** coincidir es la estructura de niveles y el `ratio` de las estaciones presentes. En `ZARATE` precio=1500 esperar **89** cases en DB (no 114 del CSV) por el hueco §2.4.

**Paso 4b — confirmar que es Patrón A:**

```sql
select count(*) filter (where categoria is null) as patron_a,
       count(*) filter (where categoria is not null) as patron_b
from tarifas_normalizadas;
```

Esperado: `patron_b = 0` (§3).

**Paso 4c — catálogo de status del peaje:**

```sql
select codigo, etiqueta, color, tipo_meta, orden
from tarifas_status_catalogo
where peaje_id = '<PEAJE_ID>'
order by orden;
```

Sin filas, la pantalla no puede dibujar botones. Es el primer lugar a mirar si la escalera aparece sin controles.

**Paso 7 — propagación:**

```sql
select p.tarifa_status, count(*) as pasadas
from pasadas p
where p.file_upload_name = 'ConsumosResumen-202607-1.xlsx'
group by 1 order by 2 desc;
```

y el cruce fila a fila con la familia confirmada:

```sql
select tn.importe, tn.status as status_familia,
       p.tarifa_status, count(*) as pasadas
from pasadas p
join tarifas_normalizadas tn on tn.id = p.tarifa_normalizada_id
where p.estacion_id = '<ESTACION_ID>'
group by 1, 2, 3
order by 1;
```

Esperado: `status_familia = tarifa_status` en todas las filas y ninguna pasada de la estación con `tarifa_normalizada_id` nulo.

**Paso 8 — Power BI:** ejecutar un `select` sobre cada vista publicada que exponga `tarifa_status` y verificar que los valores nuevos aparecen y que no hay `null` inesperados donde antes había datos.

**Paso 9 — reconciliación 1040 → 1015 (ZARATE precio=1500):**

```sql
select count(*) as en_db
from pasadas where file_upload_name = 'ConsumosResumen.xlsx';   -- esperado 1015

select e.nombre, p.precio, count(*) as pasadas
from pasadas p join estaciones e on e.id = p.estacion_id
where p.file_upload_name = 'ConsumosResumen.xlsx'
  and e.nombre ilike '%ZARATE%'
group by 1, 2 order by 2;   -- 1500 → 89; resto = CSV
```

Contrastar 1500: CSV 114 vs DB 89 (=25). Cruzar con
`scripts/telepeaje plus/202607-2/resumen.txt` (`0104-00077675 NC`). **No
corregir nada en esta pasada**: confirmar que el hueco está localizado, que no
hay NC cargada en base y que el motor filtra `tipo = 'FC'`. Si al abrir el xlsx
la hipótesis NC se refuta, anotar la causa real.

### Recordatorios de seguridad

- No pegar volcados completos de filas de producción en el chat ni en el repositorio; reportar solo diferencias y muestras chicas.
- Los artefactos temporales del análisis van fuera del repositorio o bajo `.tmp-*`, y se borran al terminar.
- Prohibido `db push` de una migración F14 que no haya pasado antes por `npx supabase db reset --local --no-seed` + `npx supabase test db`.

---

## 9. Comandos de verificación

```powershell
cd ibarra-app

# 1. Migraciones y reglas de datos (Supabase CLI local — NO DESARROLLO)
npx supabase db reset --local --no-seed
npx supabase test db

# 2. Tipado
npx tsc --noEmit -p tsconfig.app.json

# 3. Unit tests de la pantalla
ng test --include="**/peajes/auditoria-tarifas/**/*.spec.ts" --watch=false --browsers=ChromeHeadless

# 4. Suite completa de peajes (regresión)
ng test --include="**/peajes/**/*.spec.ts" --watch=false --browsers=ChromeHeadless

# 5. Verify offline de la clasificación pura (sin Angular ni Karma)
npx --yes tsx src/app/components/peajes/auditoria-tarifas/clasificacion.verify.ts

# 6. Verifies existentes que no deben romperse
npx --yes tsx src/app/components/peajes/plantillas/motor.verify.ts
npx --yes tsx src/app/components/peajes/e2e-prd21.verify.ts

# 7. Build
npm run build
```

---

## 10. Checklist Testing (agente 05 · F14-6)

```text
- [ ] Leer APENDICE-A, APENDICE-B y APENDICE-C antes de escribir pruebas
- [ ] Resolver con el product owner la pregunta abierta PATRON A/B de §3 y dejar la respuesta registrada
- [ ] Resolver con el agente 01 la decisión stddev_samp vs stddev_pop de §4.9 antes de escribir B-05
- [ ] Obtener de APENDICE-A el umbral exacto de CONCENTRADO/DISPERSO (§4.7 lo acota a (4,15 · 4,18] pero no lo fija)
- [ ] supabase/tests/peajes_f14_test.sql con los 16 casos B-01..B-16
- [ ] npx supabase db reset --local --no-seed → exit 0
- [ ] npx supabase test db → PASS, sin regresión de los 112 tests previos
- [ ] Specs frontend F-01..F-34 en los 5 archivos de §6
- [ ] Grupo STATUS S-01..S-09 implementado y separado del resto
- [ ] clasificacion.verify.ts corre sobre las 119 filas del CSV leído como latin-1
- [ ] S-02: ZARATE 1500/3000/4500/6000/7500 → NO_PICO, PICO, PICO, PICO, PICO (5 de 5)
- [ ] S-03: AGÜERO (17 niveles, 102 casos, ratio 11,538449) difiere de la sugerencia, y la prueba lo afirma
- [ ] S-06: estado final del mock = NO_PICO 52 / PICO 49 / PENDIENTE 18 sobre 119 familias
- [ ] Verificado que el umbral de muestra confiable es Casos >= 15 (mín VERDADERO 15, máx FALSO 14)
- [ ] Verificado que importe_base = mínimo importe de la estación en 34 de 34 estaciones
- [ ] Verificado que multiplicador = round(importe / base, 3) en 119 de 119 filas
- [ ] B-11 probado con NC sintéticas en el CLI local (en DESARROLLO hay 0 pasadas con precio < 0); MVP ignora NCs (no resta cases)
- [ ] B-12: desvíos ZARATE UTC coinciden con §4.3.1 (±0,01 en 4/5); BA desplaza el pico; pin AT TIME ZONE 'UTC' obligatorio
- [ ] B-13 cubre las 3 estaciones homónimas bajo dos concesiones (9 DE JULIO, OLIVERA, TRENQUE LAUQUEN)
- [ ] E2E manual §8 completo, con las 10 casillas tildadas
- [ ] Confirmado que 1015 + 696 = 1711 pasadas y que ningún file_upload_name contiene '202607-2'
- [ ] Hueco 1040 → 1015 localizado en ZARATE precio=1500 (CSV 114 vs DB 89); hipótesis NC 0104-00077675 registrada
- [ ] Prueba empírica UTC documentada (§4.3.1) y alineada con Apéndice A §15.2
- [ ] ng test --include="**/peajes/**/*.spec.ts" --watch=false --browsers=ChromeHeadless → SUCCESS
- [ ] npx tsc --noEmit -p tsconfig.app.json → exit 0
- [ ] npm run build → exit 0
- [ ] feature_list.json: F14-6 con evidencia (comando + resultado + números reales)
- [ ] docs/claude-progress.md con la entrada de sesión y las decisiones tomadas
```

---

> Última actualización: 2026-08-12
