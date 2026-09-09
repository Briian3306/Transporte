# Feature — Motor de Normalización y Auditoría Tarifaria

## 20. Descripción

Extensión de **Module Automation Tool** que analiza las `pasadas` ya importadas para
descubrir automáticamente la estructura tarifaria real de cada Concesión/Estación
(categoría de vehículo, posibles recargos horarios) cuando el proveedor **no** informa
esa estructura de forma explícita, y para **auditar** esa estructura cuando sí la informa.

No reemplaza el wizard de importación (secciones 5–9); corre **después** de guardar las
`pasadas` (post paso 9, "Revisar y guardar") como un job de análisis, y alimenta:

* El paso 8 (Validaciones) con advertencias tarifarias.
* Power BI, con una tabla ya normalizada (`tarifas_normalizadas`).
* El armado de `plantillas_configuracion`, sugiriendo mapeos de categoría cuando el
  motor detecta con confianza que ciertos niveles de Importe corresponden a categorías.

---

## 21. Los dos patrones observados

En la práctica, los proveedores caen en uno de dos casos:

### Patrón A — Sin columna de categoría (ej. Corredores Viales, Rutas Sur Atlántico)

El archivo solo trae `Importe`. La categoría del vehículo (auto, camioneta, camión de
N ejes) y un eventual recargo horario quedan **implícitos** dentro de ese único número.

### Patrón B — Con columna de categoría explícita (ej. AUSOL: campo `CATEGORIA` 1–7)

El archivo ya informa la categoría. Pero eso no garantiza que el importe sea "limpio":
puede seguir existiendo una variación adicional (recargo horario, ajuste de tarifa en
el tiempo, error de carga) que conviene auditar en vez de asumir.

**Regla de detección del patrón:** se resuelve en el paso 8 del wizard (Mapeo de
columnas). Si alguna columna del archivo se mapea a `CATEGORIA_ID`, es Patrón B;
si no, Patrón A.

```text
Archivo cargado
      │
      ▼
Mapeo de columnas (Paso 8 del wizard)
      │
      ▼
¿Alguna columna se mapeó a CATEGORIA_ID?
      │
   ┌──┴───┐
  SÍ      NO
   │       │
   ▼       ▼
Patrón B  Patrón A
(directo) (inferencia estadística)
```

---

## 22. Tabla estándar de salida (unificada para ambos patrones)

Una sola tabla, `tarifas_normalizadas`, alimentada por cualquiera de los dos patrones.
Columnas núcleo pedidas para el análisis (`Status, Estación, Importe, Cases,
Multiplicador, Desvío`), con el contexto de concesión/categoría agregado:

| Campo             | Descripción                                                                 |
| ----------------- | ---------------------------------------------------------------------------- |
| `CONCESION_ID`    | Concesión / peaje                                                            |
| `ESTACION_ID`     | Estación                                                                     |
| `CATEGORIA_ID`    | Categoría del vehículo. `NULL` si vino de Patrón A (no informada por el proveedor) |
| `IMPORTE`         | Valor de tarifa/importe de ese grupo                                        |
| `CASES`           | Cantidad de pasadas históricas con esa combinación                          |
| `MULTIPLICADOR`   | `IMPORTE / IMPORTE_BASE` de esa Estación (o de Categoría 1 en Patrón B)      |
| `DESVIO`          | Desvío estándar de la Hora de las pasadas de ese grupo                      |
| `STATUS`          | Resultado de la clasificación (ver §23 y §24)                               |
| `PATRON`          | `'A'` o `'B'`, según cómo se generó la fila                                  |
| `MUESTRA_CONFIABLE` | `CASES >= UMBRAL_MUESTRA_MINIMA`                                           |

`IMPORTE_BASE`, `UMBRAL_MUESTRA_MINIMA` y `UMBRAL_DISPERSION` son parámetros
configurables por Concesión (ver §25), no valores fijos en código.

---

## 23. Patrón A — Algoritmo de inferencia (sin categoría explícita)

```text
Pasadas de la Concesión (sin CATEGORIA_ID)
      │
      ▼
GROUP BY CONCESION_ID + ESTACION_ID + IMPORTE
      │
      ▼
CASES = COUNT(*)
      │
      ▼
IMPORTE_BASE = MIN(IMPORTE) dentro de esa ESTACION_ID
      │
      ▼
MULTIPLICADOR = IMPORTE / IMPORTE_BASE   (redondeado, ej. 3 decimales)
      │
      ▼
DESVIO = STDEV(HORA) de las pasadas de ese grupo
      │
      ▼
¿CASES >= UMBRAL_MUESTRA_MINIMA?
      │
   ┌──┴───┐
  NO      SÍ
   │       │
   ▼       ▼
STATUS =            ¿DESVIO >= UMBRAL_DISPERSION?
"MUESTRA_INSUFICIENTE"    │
                       ┌───┴────┐
                      SÍ        NO
                       │         │
                       ▼         ▼
                 STATUS =    STATUS =
                 "CATEGORIA" "POSIBLE_HORARIO"
                (variación   (candidato a
                 por eje/    recargo por
                 vehículo)   franja horaria,
                             requiere revisión
                             manual)
      │
      ▼
INSERT en `tarifas_normalizadas` (PATRON = 'A')
```

**Por qué funciona:** si el precio dependiera del horario, cada nivel de `IMPORTE`
debería concentrarse en un rango de horas (desvío bajo). Si en cambio los `CASES` de
ese nivel aparecen parejo en las 24 horas del día, el desvío se acerca al de una
distribución uniforme (`~6.9` para horas 0–23) y la variación se explica por categoría
de vehículo, no por horario. `MULTIPLICADOR` además confirma esto cuando los niveles
de `IMPORTE` son múltiplos limpios de una tarifa base (`x1, x2, x3...`), típico de
esquemas por cantidad de ejes.

`STATUS = "POSIBLE_HORARIO"` nunca se guarda como verdad automática: entra como
**Advertencia** (sección 12 del PRD) para que el Analista la confirme, salvo que se
configure el umbral de confianza para autoaprobar (ver §25).

---

## 24. Patrón B — Algoritmo de auditoría (con categoría explícita, ej. AUSOL)

Acá no hace falta inferir la categoría — pero sí conviene auditar que, controlando por
categoría, no quede una variación residual sin explicar.

```text
Pasadas de la Concesión (con CATEGORIA_ID)
      │
      ▼
GROUP BY CATEGORIA_ID + ESTACION_ID + TARIFA
      │
      ▼
CASES = COUNT(*)
      │
      ▼
¿Más de un valor de TARIFA para la misma CATEGORIA_ID + ESTACION_ID?
      │
   ┌──┴───┐
  NO      SÍ
   │       │
   ▼       ▼
STATUS =        DESVIO = STDEV(HORA) de cada nivel de TARIFA
"TARIFA_UNICA"       │
                     ▼
              ¿El ratio entre niveles de TARIFA se repite igual
               en otras Categorías de la misma Estación?
                     │
                ┌────┴─────┐
               SÍ           NO
                │             │
                ▼             ▼
         STATUS =        STATUS =
         "POSIBLE_HORARIO"  "REVISAR"
         (recargo consistente (podría ser cambio de
          → candidato fuerte   tarifa en el tiempo,
          a hora punta/valle)  promoción o error
                                de carga)
      │
      ▼
MULTIPLICADOR = TARIFA / TARIFA(CATEGORIA_ID=1, misma ESTACION_ID)
      │
      ▼
INSERT en `tarifas_normalizadas` (PATRON = 'B')
```

**Ejemplo real, detectado en el archivo `pasadas_2026-07-16_493556.csv` (AUSOL,
estación CAMPANA):**

| Categoría | Tarifa baja | Tarifa alta | Ratio alta/baja |
| --------- | ----------- | ----------- | ---------------- |
| 2         | 994.15      | 1192.99     | 1.2000            |
| 6         | 3976.59     | 4771.95     | 1.2000            |
| 7         | 4970.74     | 5964.94     | 1.2000            |

El mismo ratio (+20%) se repite en tres categorías distintas de la misma estación →
`STATUS = "POSIBLE_HORARIO"` con alta confianza: es casi seguro un recargo por franja
horaria aplicado sobre la tarifa base de cada categoría, no un error ni una
actualización de precio. Este es el tipo de hallazgo que el motor debe sacar a la
superficie automáticamente, en vez de que el Analista lo encuentre a mano fila por fila.

---

## 25. Parámetros configurables

| Parámetro                | Uso                                                              | Sugerido inicial |
| ------------------------- | ----------------------------------------------------------------- | ----------------- |
| `UMBRAL_MUESTRA_MINIMA`   | Mínimo de `CASES` para confiar en un grupo                        | 15                |
| `UMBRAL_DISPERSION`       | Desvío horario mínimo para considerar "disperso" (≈ categoría)    | `0.6 × 6.9 ≈ 4.1` |
| `AUTO_CONFIRMAR_HORARIO`  | Si `true`, `POSIBLE_HORARIO` con ratio repetido en ≥N categorías se auto-confirma como recargo horario | `false` (MVP: siempre requiere revisión manual) |

Estos parámetros son por Concesión (guardables en `plantillas_configuracion`), no
globales — dos concesiones pueden tener volúmenes y esquemas tarifarios muy distintos.

---

## 26. Nueva entidad

```text
EMPRESA
   │
   ├── PEAJES
   │      └── ESTACIONES
   │             └── PASADAS
   │                    │
   │                    ▼
   │             tarifas_normalizadas   ← nueva tabla (motor de normalización)
   │
   └── DOCUMENTOS
          └── PASADAS
```

Tabla nueva: `tarifas_normalizadas` (ver §22 para columnas).

---

## 27. Alcance MVP de esta feature

Incluye:

1. Job de agrupación Patrón A (GROUP BY + Multiplicador + Desvío + Status).
2. Job de agrupación Patrón B (GROUP BY + detección de ratio + Status).
3. Detección automática de qué patrón aplica según el mapeo de columnas.
4. Tabla `tarifas_normalizadas` exportable a Power BI.
5. Panel de revisión para que el Analista confirme o descarte `POSIBLE_HORARIO` /
   `REVISAR`.

Fuera de alcance inicial (igual que la sección 18 del PRD general):

* Auto-confirmar recargos horarios sin revisión humana.
* Detectar automáticamente el nombre/franja horaria exacta del recargo (ej. "7-10hs
  y 17-20hs") — el MVP solo señala *que* probablemente existe, no *cuándo* empieza y
  termina.
* Aplicar el resultado retroactivamente para recalcular `IMPORTE_NETO` de pasadas ya
  facturadas.
