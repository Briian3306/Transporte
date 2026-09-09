# Apéndice A — Modelo de datos y especificación SQL

> **Este documento es una especificación, no una migración.** Ningún bloque SQL de
> este apéndice fue aplicado a DESARROLLO ni existe todavía en
> `supabase/migrations/`. Cada bloque está etiquetado como *Propuesta* y debe
> validarse con el ciclo local de Supabase CLI antes de considerarse correcto.

Épica **F14 — Auditoría de Pasadas por Patrones (Normalización Tarifaria)**.
Features cubiertas acá: **F14-1** (tablas + ALTER + índices + RLS) y **F14-2**
(RPCs + enganche post-carga), ambas propiedad del **agente 01 (Backend
Supabase)**.

Documentos hermanos:

| Documento | Contenido | Dueño |
|---|---|---|
| `PLAN-auditoria-pasadas-patrones.md` | Plan principal de la épica | agente 00 |
| **`APENDICE-A-modelo-datos-sql.md`** | **Este archivo: modelo de datos y SQL** | agente 01 |
| `APENDICE-B-deteccion-categoria-y-mapeo.md` | Detección de `CATEGORIA` y mapeo en el wizard | agentes 00/02/04 |
| `APENDICE-C-pantalla-auditoria-frontend.md` | Pantalla de auditoría (UI) | agente 02 |
| `APENDICE-D-testing-y-dataset-referencia.md` | Testing y dataset de referencia | agente 05 |

Este apéndice **adapta** el borrador
[`docs/plan/normalizacion-tarifa/PLAN_Backend_Frontend_Tarifas_Normalizadas.md`](../normalizacion-tarifa/PLAN_Backend_Frontend_Tarifas_Normalizadas.md)
§28, que es explícitamente *skeleton no probado* y parte de varios supuestos
falsos sobre el esquema real. Las correcciones están listadas en
[§0. Correcciones respecto del borrador v2](#0-correcciones-respecto-del-borrador-v2).

---

## Índice

- [0. Correcciones respecto del borrador v2](#0-correcciones-respecto-del-borrador-v2)
- [1. Alcance y convenciones](#1-alcance-y-convenciones)
- [2. Diagrama de entidades](#2-diagrama-de-entidades)
- [3. DDL — tablas nuevas](#3-ddl--tablas-nuevas)
- [4. ALTER TABLE pasadas](#4-alter-table-pasadas)
- [5. peajes_normalizar_tarifas](#5-peajes_normalizar_tarifas--worker-rápido-post-carga)
- [6. peajes_recalcular_tarifas](#6-peajes_recalcular_tarifas--recálculo-completo-por-peaje)
- [7. peajes_confirmar_status_tarifa](#7-peajes_confirmar_status_tarifa)
- [8. peajes_marcar_diagnostico_tarifa](#8-peajes_marcar_diagnostico_tarifa)
- [9. peajes_listar_tarifas_normalizadas](#9-peajes_listar_tarifas_normalizadas)
- [10. peajes_grupos_similares_tarifa](#10-peajes_grupos_similares_tarifa)
- [11. RLS](#11-rls)
- [12. Enganche post-carga](#12-enganche-post-carga)
- [13. Vistas a actualizar y auditoría](#13-vistas-a-actualizar-y-auditoría)
- [14. Orden de implementación](#14-orden-de-implementación)
- [15. Riesgos SQL](#15-riesgos-sql)

---

## 0. Correcciones respecto del borrador v2

Todas las filas siguientes fueron verificadas contra DESARROLLO
(`kfffigvyvtzyczeiadxh`, PostgreSQL **17.6**) con consultas de solo lectura el
2026-08-12.

| # | Borrador v2 (§28) | Realidad verificada | Consecuencia en este apéndice |
|---|---|---|---|
| 1 | `facturas` / `pasadas.factura_id` | La tabla es `documentos` y la FK es `pasadas.documento_id` | Todo el SQL usa `documento_id`; el parámetro del worker es `p_documento_id` |
| 2 | `pasadas.cantidad` | La columna es `quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1)` | Nunca se referencia `cantidad` |
| 3 | `concesion_id` → `concesiones` | No existe `concesiones`. La concesión es `peajes(id)` | La columna se llama **`peaje_id`** en las tres tablas nuevas |
| 4 | `pasadas` tendría `peaje_id` | `pasadas` **no** tiene `peaje_id` por diseño (RN-05) | El peaje se deriva siempre por `pasadas.estacion_id → estaciones.peaje_id`. **No agregar `peaje_id` a `pasadas`** |
| 5 | `peajes.empresa_id` sería uuid | Es **`text`** (referencia lógica a `empresas.id::text`, o el literal `'__global__'`); `empresas.id` es `uuid` | Cualquier join a `empresas` requiere `e.id::text = pj.empresa_id` |
| 6 | RLS por `auth.jwt() -> 'app_metadata' -> 'empresa_id'` y roles `analista`/`admin` | No existe ese claim ni esos roles de base. Auth/RLS granular está fuera del MVP (PRD §5.2) | §11 usa el patrón plano `{tabla}_authenticated_all` del repo; la variante por rol queda documentada como **diferida, no aplicar** |
| 7 | `fn_recalcular_stats_tarifas` en `pg_cron` | `pg_cron` y `pg_net` **no** están instalados en DESARROLLO | `peajes_recalcular_tarifas` se dispara desde un botón de la UI; el `cron.schedule` queda diferido |
| 8 | Prefijos `fn_` / `rpc_` | La convención del repo es `peajes_<verbo>_<sustantivo>` sin prefijo | Todas las funciones se renombraron |
| 9 | `stddev_pop` devolvería NULL con una sola fila | `stddev_pop` devuelve **0** con una fila (`stddev_samp` es el que devuelve NULL); solo devuelve NULL con cero filas o entrada toda NULL | El `CASE` de clasificación no puede confiar en `desvio IS NULL` para detectar muestras chicas; se usa `cases < umbral` primero (ver §15.1) |
| 10 | `extract(hour from p.fecha_hora)` sin zona | `fecha_hora` es `timestamptz` y `extract` depende del `TimeZone` de sesión | Se fuerza `AT TIME ZONE 'UTC'`; la justificación completa está en §15.2 |
| 11 | No contempla notas de crédito | `documentos.tipo` ∈ {FC, NC} y las NC guardan importes **con signo negativo** | La agregación filtra `documentos.tipo = 'FC'` (ver §15.3) |
| 12 | Paso 8 del wizard | El mapeo de columnas es el **Paso 5** (`wizard/paso5-mapeo`) | Ver Apéndice B §1 |

Deriva repo ↔ remoto a tener presente: la migración
`20260811190002_peajes_algoritmo_filtrar_columna.sql` está en el repositorio pero
**no** aplicada a DESARROLLO. No afecta a F14, pero el agente 01 va a encontrarla
en el primer `db push --dry-run`.

---

## 1. Alcance y convenciones

### 1.1 Qué se construye

1. Tres tablas nuevas: `tarifas_normalizadas`, `tarifas_parametros_peaje`,
   `tarifas_status_catalogo`.
2. Tres columnas nuevas en `pasadas`.
3. Seis RPCs bajo la convención `peajes_*`.
4. Un trigger de validación de status en dos capas.
5. El enganche del worker rápido después de `peajes_confirmar_carga`.

### 1.2 Nombres de migración

Formato `YYYYMMDDHHMMSS_peajes_*.sql`, una migración por preocupación. Propuesta
de secuencia (el agente 01 debe regenerar los timestamps con
`npx supabase migration new` en el momento de escribirlas):

| Orden | Archivo propuesto | Contenido |
|---|---|---|
| 1 | `20260812HHMMSS_peajes_tarifas_normalizadas_tablas.sql` | §3 completo (3 tablas + trigger + RLS + grants) |
| 2 | `20260812HHMMSS_peajes_pasadas_tarifa_columnas.sql` | §4 (ALTER + índices) |
| 3 | `20260812HHMMSS_peajes_tarifas_rpc_normalizar.sql` | §5 y §6 |
| 4 | `20260812HHMMSS_peajes_tarifas_rpc_confirmar.sql` | §7, §8 y §10 |
| 5 | `20260812HHMMSS_peajes_tarifas_rpc_listar.sql` | §9 |
| 6 | `20260812HHMMSS_peajes_tarifas_vistas.sql` | §13 (recreación de vistas) |

Separar §3 de §4 no es cosmético: el `ALTER TABLE pasadas` toca una tabla con
3465 filas en DESARROLLO y una FK nueva hacia `tarifas_normalizadas`, así que
conviene poder revertir o repetir ese paso sin recrear las tablas.

### 1.3 Testing

Conforme a `.agents/skills/backend-supabase-write/SKILL.md`, **el entorno de
prueba de SQL es el CLI local, no DESARROLLO**:

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
npx supabase db advisors   # obligatorio tras crear tablas y políticas
```

DESARROLLO es desarrollo remoto: solo se toca con `db push --linked` después de
que el CLI está verde y con autorización explícita del usuario. Los casos de
prueba concretos (fixtures, aserciones y dataset de referencia) están en el
**Apéndice D**; este apéndice solo indica qué comando corre después de cada
grupo (§14).

### 1.4 Estilo SQL del repo

- Palabras clave en MAYÚSCULAS, identificadores en minúscula
  (ver `20260730125534_peajes_rpc_y_auditoria.sql`).
- `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` /
  `DROP POLICY IF EXISTS` antes de `CREATE POLICY`, para que la migración sea
  reejecutable en el reset local.
- Cuerpos de función **`SECURITY INVOKER`** (default del repo) salvo
  justificación escrita.
- Grants explícitos al final de cada migración:
  `GRANT EXECUTE ON FUNCTION ... TO authenticated, service_role;`.
- `COMMENT ON TABLE` / `COMMENT ON FUNCTION` con la referencia a la feature y a
  la RN correspondiente.
- Existe un esquema `peajes_private` vacío (creado en
  `20260730125534_peajes_rpc_y_auditoria.sql` línea 4) disponible para helpers
  internos que no deban exponerse por PostgREST.

### 1.5 Dónde va la documentación

La documentación de RPC/SQL va en `docs/backend/peajes/` (**no** en
`docs/08-sql/`), siguiendo la estructura de
[`docs/backend/peajes/confirmar-carga.md`](../../backend/peajes/confirmar-carga.md):
`Summary → Index → Purpose → Business Logic → Relations → Tables → Functions →
Validations → Testing → Notes`, con footer de última actualización. Además hay
que sumar las entradas nuevas a `docs/backend/peajes/index.md` y
`docs/backend/functions/index.md`. Esa tarea es **F14-5 (agente 04)** y solo se
ejecuta cuando F14-1/F14-2 están `passing`.

---

## 2. Diagrama de entidades

```text
                                 empresas
                                 ─────────
                                 id  uuid PK
                                 nombre
                                     ▲
                                     │  (referencia LÓGICA, sin FK)
                                     │  peajes.empresa_id  text  =  empresas.id::text
                                     │  o el literal '__global__'
                                     │
                                  peajes
                                  ──────
                                  id         uuid PK
                                  nombre
                                  empresa_id text
                                     │
              ┌──────────────────────┼───────────────────────────┐
              │ 1:N                  │ 1:1                       │ 1:N
              ▼                      ▼                           ▼
         estaciones        tarifas_parametros_peaje     tarifas_status_catalogo
         ──────────        ────────────────────────     ───────────────────────
         id       uuid PK  peaje_id uuid PK/FK          id        uuid PK
         peaje_id uuid FK  umbral_muestra_minima        peaje_id  uuid FK
         nombre            umbral_dispersion            codigo    text
         codigos_proveedor auto_confirmar_horario       etiqueta / color
              │                                          tipo_meta / orden
              │ 1:N                                     UK (peaje_id, codigo)
              ▼                                                  ▲
          pasadas                                                │
          ───────                                                │ valida
          id                uuid PK                              │ (trigger,
          fecha_hora        timestamptz                          │  FK condicional)
          pase_id           uuid FK → pases                      │
          patente_id        uuid FK → patentes                   │
          estacion_id       uuid FK → estaciones  ◀── el peaje   │
          documento_id      uuid FK → documentos      se DERIVA  │
          precio            numeric                   por acá    │
          bonificacion      numeric                              │
          quantity          integer                              │
          importe_neto      numeric                              │
          user_id / file_upload_name                             │
          ── NUEVAS (F14-1) ──                                   │
          categoria             text NULL      ─────┐            │
          tarifa_normalizada_id uuid NULL FK ──┐    │            │
          tarifa_status         text NOT NULL  │    │            │
                                               │    │            │
                                               ▼    │            │
                                    tarifas_normalizadas ────────┘
                                    ────────────────────
                                    id           uuid PK
                                    peaje_id     uuid FK → peajes
                                    estacion_id  uuid FK → estaciones
                                    categoria    text NULL  ◀────┘  (crudo del
                                    importe      numeric              proveedor)
                                    importe_base / multiplicador
                                    cases / desvio / hora_min / hora_max / hora_media
                                    patron  A|B
                                    diagnostico  (capa 1, fija)
                                    status       (capa 2, por peaje)
                                    muestra_confiable / confirmado_*
                                    UK NULLS NOT DISTINCT
                                       (peaje_id, estacion_id, categoria, importe)
```

**Derivación del peaje (RN-05).** No hay ni habrá `pasadas.peaje_id`. En todo el
SQL de este apéndice el peaje sale de:

```sql
FROM public.pasadas p
JOIN public.estaciones e ON e.id = p.estacion_id
-- e.peaje_id es la concesión
```

`tarifas_normalizadas.peaje_id` sí se materializa, porque es un agregado y no una
fila transaccional: guardarlo evita un join en cada filtro de la pantalla y
permite indexar por peaje. La consistencia entre `peaje_id` y
`estaciones.peaje_id` se garantiza en las funciones que insertan (siempre lo
derivan del join, nunca lo reciben como parámetro).

---

## 3. DDL — tablas nuevas

> **Propuesta a validar con `npx supabase db reset --local --no-seed`.** No aplicada.

### 3.1 `tarifas_parametros_peaje`

```sql
-- F14-1: umbrales de clasificación por concesión (peaje).
CREATE TABLE IF NOT EXISTS public.tarifas_parametros_peaje (
  peaje_id uuid PRIMARY KEY REFERENCES public.peajes (id) ON DELETE CASCADE,
  umbral_muestra_minima integer NOT NULL DEFAULT 15,
  umbral_dispersion numeric(6,3) NOT NULL DEFAULT 4.100,
  auto_confirmar_horario boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tarifas_parametros_peaje_muestra_chk CHECK (umbral_muestra_minima > 0),
  CONSTRAINT tarifas_parametros_peaje_dispersion_chk CHECK (umbral_dispersion >= 0)
);

COMMENT ON TABLE public.tarifas_parametros_peaje IS
  'F14-1 · Umbrales de clasificación tarifaria por concesión. Una fila por peaje; ausente = defaults.';
COMMENT ON COLUMN public.tarifas_parametros_peaje.umbral_muestra_minima IS
  'Mínimo de pasadas en un nivel de tarifa para considerarlo estadísticamente confiable.';
COMMENT ON COLUMN public.tarifas_parametros_peaje.umbral_dispersion IS
  'Desvío estándar horario (en horas) por debajo del cual el nivel se considera concentrado en franja (POSIBLE_HORARIO). Referencia: distribución uniforme 0-23 h ≈ 6.922.';
COMMENT ON COLUMN public.tarifas_parametros_peaje.auto_confirmar_horario IS
  'Reservado: si true, un nivel POSIBLE_HORARIO se confirmaría solo. MVP lo deja en false; la confirmación siempre es humana.';
```

La tabla es **opcional por peaje**: si no hay fila, las funciones aplican
`COALESCE(..., 15)` y `COALESCE(..., 4.100)`. Eso evita tener que sembrar una
fila por cada peaje existente antes de poder correr nada.

### 3.2 `tarifas_status_catalogo`

```sql
-- F14-1: vocabulario de status por concesión (capa 2 del modelo de dos capas).
CREATE TABLE IF NOT EXISTS public.tarifas_status_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peaje_id uuid NOT NULL REFERENCES public.peajes (id) ON DELETE CASCADE,
  codigo text NOT NULL,
  etiqueta text NOT NULL,
  color text NOT NULL DEFAULT '#94A3B8',
  tipo_meta text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tarifas_status_catalogo_tipo_meta_chk
    CHECK (tipo_meta IN ('PICO', 'NO_PICO', 'NEUTRO')),
  CONSTRAINT tarifas_status_catalogo_codigo_chk
    CHECK (btrim(codigo) <> '' AND codigo = upper(codigo)),
  CONSTRAINT tarifas_status_catalogo_reservado_chk
    CHECK (codigo NOT IN ('PENDIENTE', 'POSIBLE_HORARIO')),
  CONSTRAINT tarifas_status_catalogo_uk UNIQUE (peaje_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_tarifas_status_catalogo_peaje
  ON public.tarifas_status_catalogo (peaje_id, orden);

COMMENT ON TABLE public.tarifas_status_catalogo IS
  'F14-1 · Códigos de status que cada concesión puede asignar a un nivel de tarifa confirmado. Dataset de referencia: PICO / NO_PICO.';
COMMENT ON COLUMN public.tarifas_status_catalogo.codigo IS
  'Código en mayúsculas, único por peaje. No puede colisionar con los universales PENDIENTE / POSIBLE_HORARIO.';
COMMENT ON COLUMN public.tarifas_status_catalogo.tipo_meta IS
  'Agrupador transversal para reportes cross-concesión aunque cada peaje use nombres propios.';
COMMENT ON COLUMN public.tarifas_status_catalogo.orden IS
  'Orden sugerido por precio ascendente; la UI lo usa para pre-seleccionar la asignación.';
```

`tarifas_status_catalogo_reservado_chk` es un agregado respecto del borrador:
sin él, un peaje podría cargar el código `PENDIENTE` y volver ambigua la
distinción entre "universal" y "del catálogo" que hace el trigger de §3.4.

Semilla del dataset de referencia (va en el Apéndice D, no en la migración —
sembrar datos de negocio en una migración obliga a conocer el uuid del peaje):

```sql
-- Ejemplo, NO incluir en la migración.
INSERT INTO public.tarifas_status_catalogo (peaje_id, codigo, etiqueta, color, tipo_meta, orden)
VALUES
  ('<peaje-id>', 'NO_PICO', 'No Pico', '#22C55E', 'NO_PICO', 1),
  ('<peaje-id>', 'PICO',    'Pico',    '#EF4444', 'PICO',    2);
```

### 3.3 `tarifas_normalizadas`

```sql
-- F14-1: una fila por (peaje, estación, categoría, importe) observado.
CREATE TABLE IF NOT EXISTS public.tarifas_normalizadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peaje_id uuid NOT NULL REFERENCES public.peajes (id) ON DELETE RESTRICT,
  estacion_id uuid NOT NULL REFERENCES public.estaciones (id) ON DELETE RESTRICT,
  categoria text NULL,
  importe numeric(14,2) NOT NULL,
  importe_base numeric(14,2) NOT NULL,
  cases integer NOT NULL DEFAULT 0,
  multiplicador numeric(10,4) NOT NULL DEFAULT 1,
  desvio numeric(10,4) NULL,
  hora_min numeric(5,2) NULL,
  hora_max numeric(5,2) NULL,
  hora_media numeric(5,2) NULL,
  patron text NOT NULL,
  diagnostico text NOT NULL DEFAULT 'MUESTRA_INSUFICIENTE',
  status text NOT NULL DEFAULT 'PENDIENTE',
  muestra_confiable boolean NOT NULL DEFAULT false,
  confirmado_manual boolean NOT NULL DEFAULT false,
  confirmado_por uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  confirmado_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tarifas_normalizadas_patron_chk CHECK (patron IN ('A', 'B')),
  CONSTRAINT tarifas_normalizadas_diagnostico_chk CHECK (diagnostico IN (
    'MUESTRA_INSUFICIENTE', 'TARIFA_UNICA', 'CATEGORIA',
    'POSIBLE_HORARIO', 'REVISAR', 'CONFIRMADO'
  )),
  CONSTRAINT tarifas_normalizadas_cases_chk CHECK (cases >= 0),
  CONSTRAINT tarifas_normalizadas_importe_chk CHECK (importe > 0),
  -- Coherencia patrón ↔ categoría: A = sin categoría, B = con categoría.
  CONSTRAINT tarifas_normalizadas_patron_categoria_chk CHECK (
    (patron = 'A' AND categoria IS NULL) OR (patron = 'B' AND categoria IS NOT NULL)
  ),
  -- Un nivel confirmado tiene siempre autoría y fecha.
  CONSTRAINT tarifas_normalizadas_confirmacion_chk CHECK (
    confirmado_manual = false OR confirmado_at IS NOT NULL
  ),
  CONSTRAINT tarifas_normalizadas_uk
    UNIQUE NULLS NOT DISTINCT (peaje_id, estacion_id, categoria, importe)
);
```

#### Por qué `NULLS NOT DISTINCT` es obligatorio

En el Patrón A (archivo sin columna de categoría) **todas** las filas de
`tarifas_normalizadas` de esa estación tienen `categoria IS NULL`. Con el
comportamiento por defecto de PostgreSQL (`NULLS DISTINCT`), dos NULL nunca son
iguales, así que el índice único **no dispararía** y cada corrida de
`peajes_normalizar_tarifas` insertaría un duplicado de la misma familia
`(peaje, estación, NULL, 994.15)`. Peor: el `ON CONFLICT (peaje_id, estacion_id,
categoria, importe)` de §5 y §6 nunca haría match y el `DO UPDATE` sería código
muerto, con lo cual `cases` jamás se acumularía.

`UNIQUE NULLS NOT DISTINCT` (PostgreSQL **15+**; DESARROLLO corre 17.6, y el
CLI local debe correr una imagen ≥ 15 — verificarlo en el primer reset) hace que
los NULL se comparen como iguales, que es exactamente la semántica que necesita
el Patrón A. Es la misma razón por la que el matching en las funciones usa
`IS NOT DISTINCT FROM` en vez de `=` para `categoria`.

#### Índices

```sql
CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_peaje
  ON public.tarifas_normalizadas (peaje_id);
CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_estacion
  ON public.tarifas_normalizadas (estacion_id);
CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_status
  ON public.tarifas_normalizadas (status);
CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_diagnostico
  ON public.tarifas_normalizadas (diagnostico);
CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_categoria
  ON public.tarifas_normalizadas (categoria)
  WHERE categoria IS NOT NULL;

-- Cola de revisión de la pantalla de auditoría (Apéndice C): lo primero que
-- se muestra son los niveles no confirmados con muestra confiable.
CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_cola_revision
  ON public.tarifas_normalizadas (peaje_id, muestra_confiable DESC, cases DESC)
  WHERE confirmado_manual = false
    AND diagnostico IN ('POSIBLE_HORARIO', 'REVISAR');

-- Match de familia: el "vecindario" de un nivel dentro de su estación/categoría.
CREATE INDEX IF NOT EXISTS idx_tarifas_normalizadas_familia
  ON public.tarifas_normalizadas (estacion_id, categoria, importe);
```

El índice parcial de cola de revisión tiene `peaje_id` como primera columna
porque la pantalla siempre filtra por concesión antes que por nada (Apéndice C
§2). El predicado usa `diagnostico`, no `status`: `status` puede quedar en
`PENDIENTE` tanto para un nivel sin señal como para uno marcado `CATEGORIA` a
mano, y solo el `diagnostico` distingue "hay algo para revisar".

#### Comentarios de columna

```sql
COMMENT ON TABLE public.tarifas_normalizadas IS
  'F14-1 · Nivel de tarifa observado por (peaje, estación, categoría, importe) con su clasificación algorítmica y el status confirmado por el analista.';
COMMENT ON COLUMN public.tarifas_normalizadas.peaje_id IS
  'Concesión. Derivada siempre de estaciones.peaje_id; nunca se recibe por parámetro (RN-05).';
COMMENT ON COLUMN public.tarifas_normalizadas.categoria IS
  'Texto crudo del proveedor tal como vino en el archivo (RN-15). NULL = Patrón A (archivo sin columna de categoría). Sin FK ni catálogo; NO es patentes.categoria.';
COMMENT ON COLUMN public.tarifas_normalizadas.importe IS
  'pasadas.precio del nivel. Solo se agregan documentos tipo FC (ver riesgo de signos en NC).';
COMMENT ON COLUMN public.tarifas_normalizadas.importe_base IS
  'Importe mínimo de la familia: por estación en Patrón A, por estación+categoría en Patrón B.';
COMMENT ON COLUMN public.tarifas_normalizadas.multiplicador IS
  'importe / importe_base, 4 decimales. 1.0000 en el nivel base.';
COMMENT ON COLUMN public.tarifas_normalizadas.desvio IS
  'stddev_pop de la hora del día (0-23.99, UTC) de las pasadas del nivel. Referencia: uniforme ≈ 6.922. Bajo = concentrado en franja horaria.';
COMMENT ON COLUMN public.tarifas_normalizadas.patron IS
  'A = familia sin categoría (variación intra-estación). B = familia con categoría del proveedor.';
COMMENT ON COLUMN public.tarifas_normalizadas.diagnostico IS
  'Capa 1, algorítmica y fija: MUESTRA_INSUFICIENTE | TARIFA_UNICA | CATEGORIA | POSIBLE_HORARIO | REVISAR | CONFIRMADO.';
COMMENT ON COLUMN public.tarifas_normalizadas.status IS
  'Capa 2, entrada del usuario: PENDIENTE | POSIBLE_HORARIO (universales) o un codigo de tarifas_status_catalogo del mismo peaje. Validado por trg_validar_status_tarifa.';
COMMENT ON COLUMN public.tarifas_normalizadas.confirmado_manual IS
  'true bloquea la sobreescritura de diagnostico/status por el recálculo automático.';
```

### 3.4 Trigger de validación del status en dos capas

PostgreSQL no admite una FK condicional ("o es uno de estos dos literales, o
existe en esta otra tabla filtrada por `peaje_id`"), y un `CHECK` no puede
consultar otra tabla. Se emula con un trigger.

```sql
CREATE OR REPLACE FUNCTION public.peajes_validar_status_tarifa()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Capa universal: válida para cualquier peaje, sin catálogo.
  IF NEW.status IN ('PENDIENTE', 'POSIBLE_HORARIO') THEN
    RETURN NEW;
  END IF;

  -- Capa por concesión: debe existir en el catálogo de ESE peaje.
  IF EXISTS (
    SELECT 1
    FROM public.tarifas_status_catalogo c
    WHERE c.peaje_id = NEW.peaje_id
      AND c.codigo = NEW.status
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'status "%" no es universal ni existe en tarifas_status_catalogo para el peaje % (F14 · capa 2)',
    NEW.status, NEW.peaje_id
    USING ERRCODE = '23514';
END;
$$;

COMMENT ON FUNCTION public.peajes_validar_status_tarifa() IS
  'F14-1 · FK condicional de tarifas_normalizadas.status: universales o codigo del catálogo del peaje.';

DROP TRIGGER IF EXISTS trg_validar_status_tarifa ON public.tarifas_normalizadas;
CREATE TRIGGER trg_validar_status_tarifa
  BEFORE INSERT OR UPDATE OF status, peaje_id ON public.tarifas_normalizadas
  FOR EACH ROW EXECUTE FUNCTION public.peajes_validar_status_tarifa();
```

Dos diferencias con el borrador:

1. El trigger también se dispara con `UPDATE OF peaje_id`. Sin eso, mover una
   fila a otro peaje podría dejar un `status` huérfano respecto del catálogo
   nuevo.
2. Se fija `ERRCODE = '23514'` (`check_violation`) para que el cliente pueda
   distinguir este fallo de un error genérico y mostrar un mensaje útil en la
   pantalla (Apéndice C).

**Hueco conocido:** borrar una fila de `tarifas_status_catalogo` que ya esté en
uso deja `tarifas_normalizadas.status` apuntando a un código inexistente, porque
el trigger solo corre del lado de `tarifas_normalizadas`. Para el MVP se acepta
y se documenta: la pantalla de configuración del catálogo no ofrece borrar
códigos en uso, y el frontend degrada a un badge gris con el código crudo
(Apéndice C). Un trigger `BEFORE DELETE` sobre el catálogo sería la solución
completa y queda anotado como mejora post-MVP.

### 3.5 `updated_at`

Las tres tablas tienen `updated_at`, pero **no** se agrega un trigger genérico:
todas las escrituras pasan por las RPCs de §5–§8, que setean `updated_at = now()`
explícitamente. Agregar un trigger duplicaría el trabajo en el `UPDATE` masivo
del recálculo, que es la operación más pesada del módulo.

---

## 4. ALTER TABLE pasadas

> **Propuesta a validar con el CLI.** No aplicada.

```sql
-- F14-1: dimensión de categoría del proveedor y enlace al nivel de tarifa.
ALTER TABLE public.pasadas
  ADD COLUMN IF NOT EXISTS categoria text NULL,
  ADD COLUMN IF NOT EXISTS tarifa_normalizada_id uuid NULL
    REFERENCES public.tarifas_normalizadas (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tarifa_status text NOT NULL DEFAULT 'PENDIENTE';

COMMENT ON COLUMN public.pasadas.categoria IS
  'RN-15 · Categoría cruda del proveedor tal como vino en el archivo (Paso 5 del wizard). Sin FK, sin catálogo, sin normalizar a mayúsculas. NO confundir con patentes.categoria (TRANSPORTE|REMIS|OBRA|AUTO), que es interna y se expone como patente_categoria en pasadas_gestion.';
COMMENT ON COLUMN public.pasadas.tarifa_normalizada_id IS
  'F14-1 · Nivel de tarifa al que fue matcheada esta pasada. NULL = todavía sin clasificar.';
COMMENT ON COLUMN public.pasadas.tarifa_status IS
  'F14-1 · Copia desnormalizada de tarifas_normalizadas.status para filtrar y reportar sin join. Sin CHECK propio: el valor ya lo validó trg_validar_status_tarifa en la tabla origen.';
```

`tarifa_status` no lleva `CHECK` a propósito. El valor siempre se copia desde
`tarifas_normalizadas.status`, que ya está validado; duplicar la validación
obligaría a un `ALTER TABLE` de una tabla grande cada vez que una concesión suma
un código nuevo a su catálogo.

`ON DELETE SET NULL` en lugar de `RESTRICT`: borrar un nivel de tarifa (por
ejemplo al limpiar un recálculo mal hecho) no debe bloquearse por las pasadas
que lo referencian; simplemente vuelven a quedar sin clasificar y el próximo
recálculo las recupera.

### 4.1 Índices

```sql
CREATE INDEX IF NOT EXISTS idx_pasadas_categoria
  ON public.pasadas (categoria)
  WHERE categoria IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pasadas_tarifa_normalizada_id
  ON public.pasadas (tarifa_normalizada_id);
CREATE INDEX IF NOT EXISTS idx_pasadas_tarifa_status
  ON public.pasadas (tarifa_status);

-- Consulta más caliente del worker rápido (§5): pasadas de un documento
-- todavía sin clasificar.
CREATE INDEX IF NOT EXISTS idx_pasadas_pendiente_match
  ON public.pasadas (documento_id, estacion_id, precio)
  WHERE tarifa_normalizada_id IS NULL;
```

`idx_pasadas_categoria` es parcial (`WHERE categoria IS NOT NULL`) porque en
Patrón A la columna es NULL en el 100 % de las filas y un índice completo sería
puro desperdicio: hoy, de 3465 pasadas en DESARROLLO, **todas** quedarían con
`categoria IS NULL` tras el ALTER.

`idx_pasadas_pendiente_match` antepone `documento_id` al de estación y precio
porque el worker rápido siempre acota a un documento. El borrador lo tenía como
`(estacion_id, precio)`, que sirve al recálculo global pero no al camino
caliente.

### 4.2 Backfill de las pasadas ya importadas

En DESARROLLO hay **3465** pasadas, de las cuales **1711** vienen de los dos
archivos `ConsumosResumen` (`ConsumosResumen.xlsx` = 1015 y
`ConsumosResumen-202607-1.xlsx` = 696) y el resto de CSV de Telepase.

**Decisión: no hay backfill de `categoria`.** Los archivos `ConsumosResumen` no
traen columna de categoría, así que esas 1711 filas son Patrón A por
naturaleza: `categoria` queda NULL y es el valor correcto, no un valor faltante.
Lo mismo vale para los CSV de Telepase ya cargados.

Lo que sí hay que hacer es **clasificarlas**, y eso no es un backfill de
columnas sino correr `peajes_recalcular_tarifas(p_peaje_id)` una vez por peaje
con pasadas (§14, paso 8). Es idempotente y se puede repetir.

Queda una pregunta abierta para el usuario, que el agente 01 **no debe resolver
por su cuenta**:

> Si en el futuro se reprocesa un archivo histórico que **sí** traía columna de
> categoría y se cargó sin mapearla, ¿se acepta un `UPDATE ... FROM` puntual
> contra el archivo original para poblar `pasadas.categoria`, o se prefiere
> borrar el documento y reimportarlo por el wizard?

La segunda opción es la coherente con el diseño (el wizard es la única puerta de
entrada de datos y `registros_carga_peajes` audita cada carga), pero implica
borrar y recrear ids de pasada. Registrar la respuesta en
`docs/session-handoff.md` antes de tocar nada.

---

## 5. `peajes_normalizar_tarifas` — worker rápido post-carga

> **Propuesta a validar con el CLI.** No aplicada.

Se ejecuta una vez por documento recién confirmado. Objetivo: dejar clasificada
la carga en el orden de magnitud de un par de cientos de milisegundos, sin
recorrer el histórico completo del peaje.

**Contrato:** `peajes_normalizar_tarifas(p_documento_id uuid)` →
`TABLE (pasadas_matcheadas integer, grupos_nuevos integer)`.

```sql
CREATE OR REPLACE FUNCTION public.peajes_normalizar_tarifas(
  p_documento_id uuid
)
RETURNS TABLE (pasadas_matcheadas integer, grupos_nuevos integer)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_matcheadas integer := 0;
  v_extra integer := 0;
  v_nuevos integer := 0;
  v_tipo text;
BEGIN
  IF p_documento_id IS NULL THEN
    RAISE EXCEPTION 'p_documento_id es obligatorio';
  END IF;

  SELECT d.tipo INTO v_tipo FROM public.documentos d WHERE d.id = p_documento_id;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Documento % no encontrado', p_documento_id;
  END IF;

  -- Las NC guardan importes con signo negativo: no son niveles de tarifa.
  -- Se sale sin error para no romper el flujo de carga (ver §15.3).
  IF v_tipo <> 'FC' THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  -- -------------------------------------------------------------------------
  -- PASO 1 — camino rápido: la terna (estación, categoría, importe) ya existe.
  -- Cubre la carga recurrente del mismo peaje mes a mes, que es el caso normal.
  -- -------------------------------------------------------------------------
  UPDATE public.pasadas p
  SET tarifa_normalizada_id = tn.id,
      tarifa_status = tn.status
  FROM public.tarifas_normalizadas tn
  WHERE p.documento_id = p_documento_id
    AND p.tarifa_normalizada_id IS NULL
    AND tn.estacion_id = p.estacion_id
    AND tn.categoria IS NOT DISTINCT FROM p.categoria
    AND tn.importe = p.precio;
  GET DIAGNOSTICS v_matcheadas = ROW_COUNT;

  -- -------------------------------------------------------------------------
  -- PASO 2 — camino lento, acotado a lo que quedó sin match en ESTE documento.
  -- Agrega solo esas filas: no recorre el histórico del peaje (eso es §6).
  -- -------------------------------------------------------------------------
  WITH nuevos_grupos AS (
    SELECT
      e.peaje_id                                   AS peaje_id,
      p.estacion_id                                AS estacion_id,
      p.categoria                                  AS categoria,
      p.precio                                     AS importe,
      count(*)::integer                            AS cases,
      stddev_pop(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      )                                            AS desvio,
      min(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      )                                            AS hora_min,
      max(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      )                                            AS hora_max,
      avg(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      )                                            AS hora_media,
      CASE WHEN p.categoria IS NULL THEN 'A' ELSE 'B' END AS patron
    FROM public.pasadas p
    JOIN public.estaciones e ON e.id = p.estacion_id   -- RN-05: el peaje se deriva
    WHERE p.documento_id = p_documento_id
      AND p.tarifa_normalizada_id IS NULL
      AND p.precio > 0
    GROUP BY e.peaje_id, p.estacion_id, p.categoria, p.precio
  ),
  insertados AS (
    INSERT INTO public.tarifas_normalizadas AS tn (
      peaje_id, estacion_id, categoria, importe, importe_base,
      cases, multiplicador, desvio, hora_min, hora_max, hora_media,
      patron, diagnostico, status, muestra_confiable
    )
    SELECT
      ng.peaje_id, ng.estacion_id, ng.categoria, ng.importe,
      ng.importe,   -- importe_base provisorio: §6 lo corrige con la foto completa
      ng.cases, 1.0000,
      round(ng.desvio, 4), round(ng.hora_min, 2), round(ng.hora_max, 2), round(ng.hora_media, 2),
      ng.patron,
      -- Diagnóstico provisorio: el worker rápido no ve la familia completa, así
      -- que no puede decidir TARIFA_UNICA / CATEGORIA / POSIBLE_HORARIO.
      CASE
        WHEN ng.cases < COALESCE(
               (SELECT tp.umbral_muestra_minima
                  FROM public.tarifas_parametros_peaje tp
                 WHERE tp.peaje_id = ng.peaje_id), 15)
        THEN 'MUESTRA_INSUFICIENTE'
        ELSE 'REVISAR'
      END,
      'PENDIENTE',
      ng.cases >= COALESCE(
        (SELECT tp.umbral_muestra_minima
           FROM public.tarifas_parametros_peaje tp
          WHERE tp.peaje_id = ng.peaje_id), 15)
    FROM nuevos_grupos ng
    ON CONFLICT (peaje_id, estacion_id, categoria, importe) DO UPDATE
      SET cases = tn.cases + EXCLUDED.cases,
          muestra_confiable = (tn.cases + EXCLUDED.cases) >= COALESCE(
            (SELECT tp.umbral_muestra_minima
               FROM public.tarifas_parametros_peaje tp
              WHERE tp.peaje_id = tn.peaje_id), 15),
          updated_at = now()
      -- Nunca pisar lo que el analista confirmó a mano.
      WHERE tn.confirmado_manual = false
    RETURNING tn.id
  )
  SELECT count(*)::integer INTO v_nuevos FROM insertados;

  -- -------------------------------------------------------------------------
  -- PASO 3 — re-match: enlazar lo que el paso 2 acaba de crear.
  -- -------------------------------------------------------------------------
  UPDATE public.pasadas p
  SET tarifa_normalizada_id = tn.id,
      tarifa_status = tn.status
  FROM public.tarifas_normalizadas tn
  WHERE p.documento_id = p_documento_id
    AND p.tarifa_normalizada_id IS NULL
    AND tn.estacion_id = p.estacion_id
    AND tn.categoria IS NOT DISTINCT FROM p.categoria
    AND tn.importe = p.precio;
  GET DIAGNOSTICS v_extra = ROW_COUNT;

  RETURN QUERY SELECT (v_matcheadas + v_extra), v_nuevos;
END;
$$;

COMMENT ON FUNCTION public.peajes_normalizar_tarifas(uuid) IS
  'F14-2 · Clasifica las pasadas de un documento recién confirmado. Camino rápido por terna conocida + alta acotada de niveles nuevos. Devuelve (pasadas_matcheadas, grupos_nuevos).';

REVOKE ALL ON FUNCTION public.peajes_normalizar_tarifas(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_normalizar_tarifas(uuid) TO authenticated, service_role;
```

### Notas de implementación

- **`pasadas_matcheadas` suma los pasos 1 y 3.** El borrador solo contaba el
  paso 1, con lo cual una carga de un peaje nuevo (donde todo cae por el camino
  lento) reportaba `0` pasadas matcheadas aunque hubiera clasificado todo. El
  número que ve el usuario en el resumen post-carga tiene que ser el total.
- **`grupos_nuevos` cuenta filas devueltas por el CTE `insertados`**, que
  incluye tanto los `INSERT` como los `DO UPDATE` que efectivamente tocaron una
  fila. No es estrictamente "grupos nuevos"; es "grupos afectados". Si el
  Apéndice C necesita distinguirlos, hay que agregar un
  `RETURNING tn.id, (xmax = 0) AS fue_insert` y contar aparte —
  documentar la decisión antes de implementar.
- **`WHERE tn.confirmado_manual = false` en el `DO UPDATE`.** Si el nivel ya fue
  confirmado por un analista, ni siquiera se le suma `cases`. Es conservador a
  propósito: preferimos un `cases` desactualizado que se corrige en el próximo
  recálculo antes que tocar una fila que alguien revisó. `§6` sí actualiza los
  contadores de las filas confirmadas, sin tocar `diagnostico`/`status`.
- **`p.precio > 0`** deja afuera importes cero o negativos que podrían venir de
  ajustes; combinado con el corte por `tipo = 'FC'` cubre el problema de signos
  descrito en §15.3.
- **`SECURITY INVOKER`** es el default del repo y acá es lo correcto: la RLS
  plana de §11 permite todo a `authenticated`, así que no hace falta escalar
  privilegios.

---

## 6. `peajes_recalcular_tarifas` — recálculo completo por peaje

> **Propuesta a validar con el CLI.** No aplicada.

Recalcula toda la foto de un peaje: es la función que realmente clasifica,
porque es la única que ve la familia completa y puede decidir si un nivel es
único, si es variación por categoría o si se concentra en una franja horaria.

**Contrato:** `peajes_recalcular_tarifas(p_peaje_id uuid)` → `integer`
(cantidad de pasadas cuya clasificación cambió).

**Disparo:** manual, desde el botón *Recalcular* de la pantalla de auditoría
(Apéndice C). **No hay cron**: `pg_cron` no está instalado en DESARROLLO (ver
§15.5).

### 6.1 Fundamento estadístico del umbral de dispersión

El discriminador entre "esto es un recargo horario" y "esto es una variación por
tipo de vehículo" es la **dispersión horaria** de las pasadas de cada nivel de
tarifa.

Si las pasadas de un nivel se reparten parejo a lo largo del día, la hora del
día se comporta como una variable uniforme en `[0, 24)`. El desvío estándar
poblacional de una uniforme discreta sobre las horas 0–23 es:

```text
stddev_pop(0, 1, 2, …, 23) = 6.9222      (verificado en DESARROLLO)
```

De ahí salen las dos lecturas:

| Desvío observado | Interpretación | Diagnóstico |
|---|---|---|
| Cercano a 6.92 (o mayor) | El nivel aparece a cualquier hora → el precio no depende del reloj. Si además hay varios niveles conviviendo en la misma estación sin categoría, lo más probable es que la diferencia sea por tipo de vehículo | `CATEGORIA` |
| Muy por debajo (default: `< 4.100`) | El nivel se concentra en una franja acotada → hay una ventana horaria detrás. Candidato a recargo de hora pico | `POSIBLE_HORARIO` |

El default `4.100` no es una constante universal: es un punto de corte
calibrable por concesión en `tarifas_parametros_peaje.umbral_dispersion`. Como
referencia, un nivel que solo aparece entre las 7 y las 10 de la mañana tiene un
desvío del orden de 0.9–1.2 h; uno que aparece en dos picos separados
(mañana y tarde) puede llegar a 4–5 h, que es justamente la zona gris donde el
default está puesto para pedir revisión humana.

**El algoritmo nunca decide solo.** `POSIBLE_HORARIO` es una hipótesis que el
analista confirma o descarta desde la pantalla; el campo
`auto_confirmar_horario` existe para el futuro y en el MVP queda en `false`.

### 6.2 SQL

```sql
CREATE OR REPLACE FUNCTION public.peajes_recalcular_tarifas(
  p_peaje_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_umbral_muestra integer;
  v_umbral_dispersion numeric;
  v_actualizados integer := 0;
BEGIN
  IF p_peaje_id IS NULL THEN
    RAISE EXCEPTION 'p_peaje_id es obligatorio';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.peajes WHERE id = p_peaje_id) THEN
    RAISE EXCEPTION 'Peaje % no existe', p_peaje_id;
  END IF;

  SELECT tp.umbral_muestra_minima, tp.umbral_dispersion
    INTO v_umbral_muestra, v_umbral_dispersion
  FROM public.tarifas_parametros_peaje tp
  WHERE tp.peaje_id = p_peaje_id;

  v_umbral_muestra    := COALESCE(v_umbral_muestra, 15);
  v_umbral_dispersion := COALESCE(v_umbral_dispersion, 4.100);

  WITH agregado AS (
    SELECT
      e.peaje_id      AS peaje_id,
      p.estacion_id   AS estacion_id,
      p.categoria     AS categoria,
      p.precio        AS importe,
      count(*)::integer AS cases,
      stddev_pop(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      ) AS desvio,
      min(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      ) AS hora_min,
      max(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      ) AS hora_max,
      avg(
        extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
        + extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
      ) AS hora_media
    FROM public.pasadas p
    JOIN public.estaciones e ON e.id = p.estacion_id      -- RN-05
    JOIN public.documentos d ON d.id = p.documento_id
    WHERE e.peaje_id = p_peaje_id
      AND d.tipo = 'FC'        -- las NC tienen importes negativos (§15.3)
      AND p.precio > 0
    GROUP BY e.peaje_id, p.estacion_id, p.categoria, p.precio
  ),
  con_familia AS (
    SELECT
      a.*,
      -- Patrón A: la familia es la estación entera (no hay categoría que separe).
      -- Patrón B: la familia es estación + categoría.
      CASE
        WHEN a.categoria IS NULL
          THEN min(a.importe) OVER (PARTITION BY a.peaje_id, a.estacion_id)
        ELSE min(a.importe) OVER (PARTITION BY a.peaje_id, a.estacion_id, a.categoria)
      END AS importe_base,
      CASE
        WHEN a.categoria IS NULL
          THEN count(DISTINCT a.importe) OVER (PARTITION BY a.peaje_id, a.estacion_id)
        ELSE count(DISTINCT a.importe) OVER (PARTITION BY a.peaje_id, a.estacion_id, a.categoria)
      END AS niveles_familia
    FROM agregado a
  ),
  clasificado AS (
    SELECT
      cf.*,
      round(cf.importe / NULLIF(cf.importe_base, 0), 4) AS multiplicador,
      CASE WHEN cf.categoria IS NULL THEN 'A' ELSE 'B' END AS patron,
      CASE
        -- 1) Sin datos suficientes no se afirma nada. Va PRIMERO porque
        --    stddev_pop de una sola fila devuelve 0, no NULL (§15.1).
        WHEN cf.cases < v_umbral_muestra THEN 'MUESTRA_INSUFICIENTE'
        -- 2) Un solo nivel en la familia: no hay nada que comparar.
        WHEN cf.niveles_familia = 1 THEN 'TARIFA_UNICA'
        -- 3) Patrón A con dispersión alta: el precio no depende del reloj,
        --    lo más probable es variación por tipo de vehículo.
        WHEN cf.categoria IS NULL
             AND (cf.desvio IS NULL OR cf.desvio >= v_umbral_dispersion) THEN 'CATEGORIA'
        -- 4) Dispersión baja: se concentra en una franja → candidato horario.
        WHEN cf.desvio IS NOT NULL AND cf.desvio < v_umbral_dispersion THEN 'POSIBLE_HORARIO'
        ELSE 'REVISAR'
      END AS diagnostico_calculado
    FROM con_familia cf
  ),
  upsert AS (
    INSERT INTO public.tarifas_normalizadas AS tn (
      peaje_id, estacion_id, categoria, importe, importe_base,
      cases, multiplicador, desvio, hora_min, hora_max, hora_media,
      patron, diagnostico, status, muestra_confiable
    )
    SELECT
      c.peaje_id, c.estacion_id, c.categoria, c.importe, c.importe_base,
      c.cases, c.multiplicador,
      round(c.desvio, 4), round(c.hora_min, 2), round(c.hora_max, 2), round(c.hora_media, 2),
      c.patron, c.diagnostico_calculado,
      CASE WHEN c.diagnostico_calculado = 'POSIBLE_HORARIO'
           THEN 'POSIBLE_HORARIO' ELSE 'PENDIENTE' END,
      c.cases >= v_umbral_muestra
    FROM clasificado c
    ON CONFLICT (peaje_id, estacion_id, categoria, importe) DO UPDATE
      SET cases             = EXCLUDED.cases,
          importe_base      = EXCLUDED.importe_base,
          multiplicador     = EXCLUDED.multiplicador,
          desvio            = EXCLUDED.desvio,
          hora_min          = EXCLUDED.hora_min,
          hora_max          = EXCLUDED.hora_max,
          hora_media        = EXCLUDED.hora_media,
          muestra_confiable = EXCLUDED.muestra_confiable,
          patron            = EXCLUDED.patron,
          -- Las estadísticas siempre se refrescan; el juicio humano no se pisa.
          diagnostico = CASE WHEN tn.confirmado_manual THEN tn.diagnostico ELSE EXCLUDED.diagnostico END,
          status      = CASE WHEN tn.confirmado_manual THEN tn.status      ELSE EXCLUDED.status      END,
          updated_at  = now()
    RETURNING tn.id, tn.estacion_id, tn.categoria, tn.importe, tn.status
  )
  UPDATE public.pasadas p
  SET tarifa_normalizada_id = u.id,
      tarifa_status = u.status
  FROM upsert u
  WHERE p.estacion_id = u.estacion_id
    AND p.categoria IS NOT DISTINCT FROM u.categoria
    AND p.precio = u.importe
    AND (p.tarifa_normalizada_id IS DISTINCT FROM u.id
         OR p.tarifa_status IS DISTINCT FROM u.status);
  GET DIAGNOSTICS v_actualizados = ROW_COUNT;

  RETURN v_actualizados;
END;
$$;

COMMENT ON FUNCTION public.peajes_recalcular_tarifas(uuid) IS
  'F14-2 · Recálculo completo de niveles de tarifa de un peaje: estadísticas, importe_base, multiplicador, diagnóstico y propagación a pasadas.tarifa_status. Disparo manual desde la UI (no hay pg_cron). Devuelve pasadas actualizadas.';

REVOKE ALL ON FUNCTION public.peajes_recalcular_tarifas(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_recalcular_tarifas(uuid) TO authenticated, service_role;
```

### 6.3 Diferencias con el borrador v2 §28.6

| Borrador | Acá | Motivo |
|---|---|---|
| `count(distinct importe) OVER (PARTITION BY concesion, estacion, categoria)` para ambos patrones | Ventana condicional según patrón, igual que `importe_base` | Con `categoria IS NULL`, el `PARTITION BY … , categoria` de PostgreSQL agrupa todos los NULL juntos y por casualidad da el resultado correcto en Patrón A, pero la intención quedaba implícita. Explicitarla evita que un cambio futuro rompa el Patrón A en silencio |
| `WHERE tn.confirmado_manual = false OR tn.cases IS DISTINCT FROM excluded.cases` en el `DO UPDATE` | Sin `WHERE`; el `SET` usa `CASE WHEN tn.confirmado_manual` | El `WHERE` del borrador impedía refrescar `desvio`/`hora_*` de una fila confirmada cuyo `cases` no cambió, y sacaba esa fila del `RETURNING`, rompiendo la propagación. El `CASE` protege lo que hay que proteger (diagnóstico y status) y deja fluir las estadísticas |
| `UPDATE … FROM upsert u, tarifas_normalizadas tn2 WHERE tn2.id = u.id` | El `RETURNING` ya trae `estacion_id`, `categoria` e `importe` | Elimina un join innecesario contra la tabla que se acaba de escribir |
| Sin filtro de tipo de documento | `JOIN documentos d … AND d.tipo = 'FC'` | §15.3 |
| `extract(hour from fecha_hora)` | `… AT TIME ZONE 'UTC'` | §15.2 |

### 6.4 Costo

Recorre todas las pasadas del peaje. Con 3465 pasadas en total en DESARROLLO es
irrelevante, pero el plan debe apoyarse en `idx_pasadas_estacion` para el join
con `estaciones` filtrada por `peaje_id`. Verificar con `EXPLAIN ANALYZE` en el
CLI local sobre el dataset del Apéndice D antes de dar por buena la feature; si
el volumen crece un orden de magnitud, el siguiente paso natural es acotar el
recálculo por rango de fechas (parámetro opcional `p_desde`), que hoy queda
fuera de alcance.

---

## 7. `peajes_confirmar_status_tarifa`

> **Propuesta a validar con el CLI.** No aplicada.

El analista asigna un código de status a cada nivel de una familia. Soporta **N
niveles**, no solo dos: una concesión puede tener `LIBRE` / `PICO` /
`NIGHT_PICO` y el payload simplemente trae tres elementos.

**Contrato:** `peajes_confirmar_status_tarifa(p_asignaciones jsonb)` → `jsonb`.

Payload de entrada:

```json
[
  { "tarifa_normalizada_id": "…uuid…", "status_codigo": "NO_PICO" },
  { "tarifa_normalizada_id": "…uuid…", "status_codigo": "PICO" }
]
```

Retorno:

```json
{ "niveles_confirmados": 2, "pasadas_actualizadas": 118 }
```

```sql
CREATE OR REPLACE FUNCTION public.peajes_confirmar_status_tarifa(
  p_asignaciones jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_niveles integer := 0;
  v_pasadas integer := 0;
  v_uid uuid := auth.uid();
BEGIN
  IF p_asignaciones IS NULL OR jsonb_typeof(p_asignaciones) <> 'array' THEN
    RAISE EXCEPTION 'p_asignaciones debe ser un arreglo JSON';
  END IF;

  IF jsonb_array_length(p_asignaciones) = 0 THEN
    RETURN jsonb_build_object('niveles_confirmados', 0, 'pasadas_actualizadas', 0);
  END IF;

  -- Una sola sentencia para todas las asignaciones: el trigger de validación
  -- corre por fila igual, pero el planner recorre tarifas_normalizadas una vez.
  WITH entrada AS (
    SELECT
      (a->>'tarifa_normalizada_id')::uuid AS id,
      upper(btrim(a->>'status_codigo'))   AS status_codigo
    FROM jsonb_array_elements(p_asignaciones) AS a
  ),
  validada AS (
    SELECT e.id, e.status_codigo
    FROM entrada e
    WHERE e.id IS NOT NULL AND e.status_codigo IS NOT NULL
  ),
  confirmados AS (
    UPDATE public.tarifas_normalizadas tn
    SET diagnostico       = 'CONFIRMADO',
        status            = v.status_codigo,   -- trg_validar_status_tarifa valida
        confirmado_manual = true,
        confirmado_por    = v_uid,
        confirmado_at     = now(),
        updated_at        = now()
    FROM validada v
    WHERE tn.id = v.id
    RETURNING tn.id, tn.estacion_id, tn.categoria, tn.importe, tn.status
  ),
  propagadas AS (
    UPDATE public.pasadas p
    SET tarifa_normalizada_id = c.id,
        tarifa_status = c.status
    FROM confirmados c
    WHERE p.estacion_id = c.estacion_id
      AND p.categoria IS NOT DISTINCT FROM c.categoria
      AND p.precio = c.importe
      AND (p.tarifa_normalizada_id IS DISTINCT FROM c.id
           OR p.tarifa_status IS DISTINCT FROM c.status)
    RETURNING p.id
  )
  SELECT
    (SELECT count(*) FROM confirmados),
    (SELECT count(*) FROM propagadas)
  INTO v_niveles, v_pasadas;

  IF v_niveles <> jsonb_array_length(p_asignaciones) THEN
    RAISE EXCEPTION 'Se recibieron % asignaciones pero solo % niveles existen',
      jsonb_array_length(p_asignaciones), v_niveles;
  END IF;

  RETURN jsonb_build_object(
    'niveles_confirmados', v_niveles,
    'pasadas_actualizadas', v_pasadas
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_confirmar_status_tarifa(jsonb) IS
  'F14-2 · Confirma la asignación de status a N niveles de una familia de tarifas y la propaga a pasadas.tarifa_status. Falla completa si algún id no existe.';

REVOKE ALL ON FUNCTION public.peajes_confirmar_status_tarifa(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_confirmar_status_tarifa(jsonb) TO authenticated, service_role;
```

### Por qué SQL de conjunto y no un bucle

El borrador v2 §28.7 usa `FOR v_item IN SELECT * FROM jsonb_array_elements(...)`
con dos `UPDATE` adentro. Se reemplazó por CTEs encadenadas por tres razones:

1. **Correctitud.** En el bucle del borrador, el segundo `UPDATE` hace
   `p.precio = (SELECT importe FROM tarifas_normalizadas WHERE id = v_id)`:
   una subconsulta por iteración a la fila que se acaba de actualizar. Con el
   `RETURNING` de la CTE el importe viaja junto con el resto y no hay relectura.
2. **Costo.** Con N niveles, el bucle hace 2·N sentencias y 2·N planificaciones;
   la versión de conjunto hace una. En una familia de 2 niveles la diferencia es
   irrelevante, pero la confirmación en lote de grupos similares (§10) puede
   mandar decenas de asignaciones en un solo llamado.
3. **Atomicidad legible.** Con CTEs, o entran todas las asignaciones o no entra
   ninguna, y eso queda explícito en el `RAISE EXCEPTION` final que compara la
   cantidad recibida contra la cantidad efectivamente actualizada. En el bucle,
   un id inexistente pasaba desapercibido (el `UPDATE` no encontraba fila, el
   `RETURNING INTO` dejaba NULL y el segundo `UPDATE` no hacía nada, sin error).

El trigger `trg_validar_status_tarifa` sigue corriendo `FOR EACH ROW`, así que la
validación del código contra el catálogo del peaje se mantiene intacta.

`auth.uid()` se captura una vez en `v_uid` en lugar de invocarse por fila
(recomendación de rendimiento de la skill `supabase-postgres-best-practices`).

---

## 8. `peajes_marcar_diagnostico_tarifa`

> **Propuesta a validar con el CLI.** No aplicada.

Acciones de un solo nivel: *«Es variación por categoría, no horario»* y
*«Marcar para revisar»*. No asignan un código del catálogo, así que el status
vuelve a `PENDIENTE`.

```sql
CREATE OR REPLACE FUNCTION public.peajes_marcar_diagnostico_tarifa(
  p_tarifa_normalizada_id uuid,
  p_diagnostico text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_pasadas integer := 0;
  v_uid uuid := auth.uid();
  v_row public.tarifas_normalizadas%ROWTYPE;
BEGIN
  IF p_tarifa_normalizada_id IS NULL THEN
    RAISE EXCEPTION 'p_tarifa_normalizada_id es obligatorio';
  END IF;

  IF p_diagnostico IS NULL OR p_diagnostico NOT IN ('CATEGORIA', 'REVISAR') THEN
    RAISE EXCEPTION 'diagnóstico % no permitido en esta función (solo CATEGORIA | REVISAR)', p_diagnostico;
  END IF;

  UPDATE public.tarifas_normalizadas
  SET diagnostico       = p_diagnostico,
      status            = 'PENDIENTE',
      confirmado_manual = true,
      confirmado_por    = v_uid,
      confirmado_at     = now(),
      updated_at        = now()
  WHERE id = p_tarifa_normalizada_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nivel de tarifa % no encontrado', p_tarifa_normalizada_id;
  END IF;

  UPDATE public.pasadas p
  SET tarifa_status = 'PENDIENTE',
      tarifa_normalizada_id = v_row.id
  WHERE p.estacion_id = v_row.estacion_id
    AND p.categoria IS NOT DISTINCT FROM v_row.categoria
    AND p.precio = v_row.importe
    AND (p.tarifa_status IS DISTINCT FROM 'PENDIENTE'
         OR p.tarifa_normalizada_id IS DISTINCT FROM v_row.id);
  GET DIAGNOSTICS v_pasadas = ROW_COUNT;

  RETURN jsonb_build_object(
    'tarifa_normalizada_id', v_row.id,
    'diagnostico', v_row.diagnostico,
    'pasadas_actualizadas', v_pasadas
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_marcar_diagnostico_tarifa(uuid, text) IS
  'F14-2 · Marca un nivel de tarifa como CATEGORIA o REVISAR (acciones de un solo nivel del panel de comparación). Deja status en PENDIENTE y bloquea la sobreescritura automática.';

REVOKE ALL ON FUNCTION public.peajes_marcar_diagnostico_tarifa(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_marcar_diagnostico_tarifa(uuid, text) TO authenticated, service_role;
```

Nota de diseño: `confirmado_manual = true` también acá. Marcar «es categoría» es
una decisión humana y el recálculo automático no debe revertirla en la próxima
corrida. Para deshacerla hace falta una acción explícita de reapertura, que no
está en el MVP (queda como `peajes_reabrir_tarifa` para una iteración futura).

---

## 9. `peajes_listar_tarifas_normalizadas`

> **Propuesta a validar con el CLI.** No aplicada.

RPC de listado de la pantalla de auditoría. Su forma imita a
`peajes_listar_pasadas`
(`20260803190348_peajes_pasadas_audit_gestion.sql`, líneas 252–383) y
`peajes_listar_estaciones_pendientes`
(`20260810142350_peajes_listar_estaciones_pendientes.sql`): filtros por `jsonb`,
whitelist de columnas ordenables, `LEAST/GREATEST` sobre el tamaño de página y
retorno `jsonb` con `rows` + `total`.

**Divergencia de firma a tener presente.** El contrato compartido de la épica
fija `peajes_listar_tarifas_normalizadas(p_filtros jsonb, p_page int,
p_page_size int, p_sort text)`, que usa página/tamaño en vez de
`limit`/`offset` y no tiene `p_dir` separado. Se respeta el contrato y se
resuelve la dirección **dentro** de `p_sort` con el formato `campo:dir`
(por ejemplo `'cases:desc'`). El offset se deriva:
`offset = (page − 1) × page_size`. La decisión hay que reflejarla en
`docs/backend/peajes/` cuando el agente 04 documente (F14-5), porque rompe la
simetría con las otras dos RPC de listado.

### 9.1 Contrato de la fila devuelta

El Apéndice C depende de esta lista campo por campo. Toda fila de `rows` tiene
exactamente estas claves:

| Campo | Tipo JSON | Origen | Notas |
|---|---|---|---|
| `id` | string (uuid) | `tarifas_normalizadas.id` | Clave para todas las acciones |
| `peaje_id` | string (uuid) | `tarifas_normalizadas.peaje_id` | |
| `peaje_nombre` | string | `peajes.nombre` | |
| `empresa_id` | string \| null | `peajes.empresa_id` | **text**, puede ser `'__global__'` |
| `empresa_nombre` | string \| null | `empresas.nombre` | join con cast `e.id::text = pj.empresa_id`; null si `'__global__'` |
| `estacion_id` | string (uuid) | `tarifas_normalizadas.estacion_id` | |
| `estacion_nombre` | string | `estaciones.nombre` | |
| `categoria` | string \| null | `tarifas_normalizadas.categoria` | null ⇒ Patrón A |
| `importe` | number | `numeric(14,2)` | |
| `importe_base` | number | `numeric(14,2)` | mínimo de la familia |
| `multiplicador` | number | `numeric(10,4)` | `importe / importe_base` |
| `cases` | number (int) | | pasadas del nivel |
| `desvio` | number \| null | `numeric(10,4)` | horas; null solo si el grupo quedó sin datos |
| `hora_min` | number \| null | `numeric(5,2)` | 0–23.99, hora UTC |
| `hora_max` | number \| null | `numeric(5,2)` | |
| `hora_media` | number \| null | `numeric(5,2)` | |
| `patron` | string | `'A'` \| `'B'` | |
| `diagnostico` | string | 6 valores fijos | capa 1 |
| `status` | string | | capa 2 |
| `status_etiqueta` | string \| null | `tarifas_status_catalogo.etiqueta` | null para los universales |
| `status_color` | string \| null | `tarifas_status_catalogo.color` | null para los universales |
| `status_tipo_meta` | string \| null | `PICO`\|`NO_PICO`\|`NEUTRO` | null para los universales |
| `muestra_confiable` | boolean | | `cases >= umbral` |
| `confirmado_manual` | boolean | | |
| `confirmado_por` | string (uuid) \| null | `auth.users.id` | la RPC **no** resuelve el email |
| `confirmado_at` | string (ISO) \| null | `timestamptz` | |
| `niveles_familia` | number (int) | calculado | cantidad de importes distintos en la familia; la UI lo usa para saber si el panel de comparación tiene sentido |
| `created_at` | string (ISO) | | |
| `updated_at` | string (ISO) | | |

Envoltorio de respuesta, idéntico en forma a las otras dos RPC de listado:

```json
{
  "rows": [ … ],
  "total": 128,
  "page": 1,
  "page_size": 50
}
```

### 9.2 Filtros aceptados en `p_filtros`

| Clave | Tipo | Semántica |
|---|---|---|
| `peaje_id` | uuid (string) | Igualdad. La pantalla siempre lo manda |
| `estacion_ids` | array de uuid | `IN`; vacío = sin filtro |
| `categorias` | array de string | `IN` sobre el texto crudo; el valor especial `"__SIN_CATEGORIA__"` matchea `categoria IS NULL` |
| `status` | array de string | `IN` sobre `status` |
| `diagnosticos` | array de string | `IN` sobre `diagnostico` |
| `patron` | `'A'` \| `'B'` | Igualdad |
| `muestra_confiable` | boolean | Igualdad |
| `confirmado_manual` | boolean | Igualdad |
| `q_estacion` | string | `ILIKE '%…%'` sobre `estaciones.nombre` |

`"__SIN_CATEGORIA__"` existe porque JSON no distingue "no filtres" de "filtrá
por NULL"; sin ese centinela no habría forma de pedir "solo Patrón A" desde la
pantalla.

### 9.3 SQL

```sql
CREATE OR REPLACE FUNCTION public.peajes_listar_tarifas_normalizadas(
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_sort text DEFAULT 'cases:desc'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  v_page      integer := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);
  v_offset    integer;
  v_sort_raw  text := lower(COALESCE(NULLIF(btrim(p_sort), ''), 'cases:desc'));
  v_sort      text := split_part(v_sort_raw, ':', 1);
  v_asc       boolean := split_part(v_sort_raw, ':', 2) = 'asc';
  v_rows  jsonb;
  v_total bigint;
  v_peaje_id uuid;
  v_estacion_ids uuid[];
  v_categorias text[];
  v_sin_categoria boolean := false;
  v_status text[];
  v_diagnosticos text[];
  v_patron text;
  v_muestra boolean;
  v_confirmado boolean;
  v_q_estacion text;
BEGIN
  v_offset := (v_page - 1) * v_page_size;

  IF v_sort NOT IN (
    'cases', 'importe', 'multiplicador', 'desvio', 'hora_media',
    'estacion_nombre', 'categoria', 'status', 'diagnostico', 'updated_at'
  ) THEN
    v_sort := 'cases';
  END IF;

  v_peaje_id := NULLIF(p_filtros->>'peaje_id', '')::uuid;
  v_patron   := NULLIF(upper(btrim(COALESCE(p_filtros->>'patron', ''))), '');
  v_q_estacion := NULLIF(btrim(p_filtros->>'q_estacion'), '');

  IF p_filtros ? 'muestra_confiable' AND jsonb_typeof(p_filtros->'muestra_confiable') = 'boolean' THEN
    v_muestra := (p_filtros->>'muestra_confiable')::boolean;
  END IF;
  IF p_filtros ? 'confirmado_manual' AND jsonb_typeof(p_filtros->'confirmado_manual') = 'boolean' THEN
    v_confirmado := (p_filtros->>'confirmado_manual')::boolean;
  END IF;

  IF p_filtros ? 'estacion_ids' AND jsonb_typeof(p_filtros->'estacion_ids') = 'array' THEN
    SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_estacion_ids
    FROM jsonb_array_elements_text(p_filtros->'estacion_ids') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_estacion_ids := ARRAY[]::uuid[];
  END IF;

  IF p_filtros ? 'categorias' AND jsonb_typeof(p_filtros->'categorias') = 'array' THEN
    SELECT COALESCE(array_agg(value), ARRAY[]::text[]) INTO v_categorias
    FROM jsonb_array_elements_text(p_filtros->'categorias') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL AND value <> '__SIN_CATEGORIA__';
    v_sin_categoria := EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(p_filtros->'categorias') AS t(value)
      WHERE value = '__SIN_CATEGORIA__'
    );
  ELSE
    v_categorias := ARRAY[]::text[];
  END IF;

  IF p_filtros ? 'status' AND jsonb_typeof(p_filtros->'status') = 'array' THEN
    SELECT COALESCE(array_agg(value), ARRAY[]::text[]) INTO v_status
    FROM jsonb_array_elements_text(p_filtros->'status') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_status := ARRAY[]::text[];
  END IF;

  IF p_filtros ? 'diagnosticos' AND jsonb_typeof(p_filtros->'diagnosticos') = 'array' THEN
    SELECT COALESCE(array_agg(value), ARRAY[]::text[]) INTO v_diagnosticos
    FROM jsonb_array_elements_text(p_filtros->'diagnosticos') AS t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_diagnosticos := ARRAY[]::text[];
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _tn_filtradas ON COMMIT DROP AS SELECT 1 WHERE false;

  -- Nota de implementación: para evitar duplicar el bloque WHERE (como hacen
  -- peajes_listar_pasadas y peajes_listar_estaciones_pendientes, que lo repiten
  -- para el count y para las filas), acá se materializa una sola vez.
  DROP TABLE IF EXISTS _tn_filtradas;
  CREATE TEMP TABLE _tn_filtradas ON COMMIT DROP AS
  SELECT
    tn.id,
    tn.peaje_id,
    pj.nombre        AS peaje_nombre,
    pj.empresa_id    AS empresa_id,
    emp.nombre       AS empresa_nombre,
    tn.estacion_id,
    est.nombre       AS estacion_nombre,
    tn.categoria,
    tn.importe,
    tn.importe_base,
    tn.multiplicador,
    tn.cases,
    tn.desvio,
    tn.hora_min,
    tn.hora_max,
    tn.hora_media,
    tn.patron,
    tn.diagnostico,
    tn.status,
    cat.etiqueta   AS status_etiqueta,
    cat.color      AS status_color,
    cat.tipo_meta  AS status_tipo_meta,
    tn.muestra_confiable,
    tn.confirmado_manual,
    tn.confirmado_por,
    tn.confirmado_at,
    (
      SELECT count(DISTINCT f.importe)::integer
      FROM public.tarifas_normalizadas f
      WHERE f.estacion_id = tn.estacion_id
        AND f.categoria IS NOT DISTINCT FROM tn.categoria
    )              AS niveles_familia,
    tn.created_at,
    tn.updated_at
  FROM public.tarifas_normalizadas tn
  JOIN public.peajes     pj  ON pj.id = tn.peaje_id
  JOIN public.estaciones est ON est.id = tn.estacion_id
  -- peajes.empresa_id es TEXT y empresas.id es UUID: el cast es obligatorio.
  LEFT JOIN public.empresas emp ON emp.id::text = pj.empresa_id
  LEFT JOIN public.tarifas_status_catalogo cat
         ON cat.peaje_id = tn.peaje_id AND cat.codigo = tn.status
  WHERE (v_peaje_id IS NULL OR tn.peaje_id = v_peaje_id)
    AND (cardinality(v_estacion_ids) = 0 OR tn.estacion_id = ANY (v_estacion_ids))
    AND (
      (cardinality(v_categorias) = 0 AND NOT v_sin_categoria)
      OR tn.categoria = ANY (v_categorias)
      OR (v_sin_categoria AND tn.categoria IS NULL)
    )
    AND (cardinality(v_status) = 0 OR tn.status = ANY (v_status))
    AND (cardinality(v_diagnosticos) = 0 OR tn.diagnostico = ANY (v_diagnosticos))
    AND (v_patron IS NULL OR tn.patron = v_patron)
    AND (v_muestra IS NULL OR tn.muestra_confiable = v_muestra)
    AND (v_confirmado IS NULL OR tn.confirmado_manual = v_confirmado)
    AND (v_q_estacion IS NULL OR est.nombre ILIKE '%' || v_q_estacion || '%');

  SELECT count(*)::bigint INTO v_total FROM _tn_filtradas;

  SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT f.*
    FROM _tn_filtradas f
    ORDER BY
      CASE WHEN v_asc     AND v_sort = 'cases'           THEN f.cases END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'cases'           THEN f.cases END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'importe'         THEN f.importe END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'importe'         THEN f.importe END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'multiplicador'   THEN f.multiplicador END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'multiplicador'   THEN f.multiplicador END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'desvio'          THEN f.desvio END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'desvio'          THEN f.desvio END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'hora_media'      THEN f.hora_media END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'hora_media'      THEN f.hora_media END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'estacion_nombre' THEN f.estacion_nombre END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'estacion_nombre' THEN f.estacion_nombre END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'categoria'       THEN f.categoria END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'categoria'       THEN f.categoria END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'status'          THEN f.status END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'status'          THEN f.status END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'diagnostico'     THEN f.diagnostico END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'diagnostico'     THEN f.diagnostico END DESC NULLS LAST,
      CASE WHEN v_asc     AND v_sort = 'updated_at'      THEN f.updated_at END ASC  NULLS LAST,
      CASE WHEN NOT v_asc AND v_sort = 'updated_at'      THEN f.updated_at END DESC NULLS LAST,
      f.estacion_nombre ASC,
      f.importe ASC
    LIMIT v_page_size OFFSET v_offset
  ) x;

  RETURN jsonb_build_object(
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total', COALESCE(v_total, 0),
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

COMMENT ON FUNCTION public.peajes_listar_tarifas_normalizadas(jsonb, integer, integer, text) IS
  'F14-2 · Listado paginado/filtrado de niveles de tarifa para la pantalla de auditoría. p_sort usa formato campo:dir.';

REVOKE ALL ON FUNCTION public.peajes_listar_tarifas_normalizadas(jsonb, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_listar_tarifas_normalizadas(jsonb, integer, integer, text)
  TO authenticated, service_role;
```

**Alternativa a evaluar en el CLI.** La tabla temporal evita duplicar el bloque
`WHERE` (el patrón de copy-paste que tienen las otras dos RPC de listado, ver
`20260810142350_peajes_listar_estaciones_pendientes.sql` líneas 51–140, donde el
mismo CTE aparece dos veces). Tiene un costo: crea una tabla temporal por
llamado, lo que en PgBouncer en modo transacción es correcto pero agrega
overhead. Si el `EXPLAIN ANALYZE` del Apéndice D muestra que no compensa, la
alternativa es volver al patrón duplicado del repo, que es feo pero está probado
y es el que un revisor va a reconocer. **Decisión pendiente del agente 01 con
medición en mano**; hasta entonces, la versión con tabla temporal es la
propuesta y la duplicada es el plan B.

`niveles_familia` se calcula con una subconsulta correlacionada por fila. Con
pocos cientos de niveles por peaje es aceptable; si crece, moverlo a una ventana
sobre el conjunto filtrado.

---

## 10. `peajes_grupos_similares_tarifa`

> **Propuesta a validar con el CLI.** No aplicada.

Detector de repetición de ratios: si en `CAMPANA` los dos niveles guardan la
relación 1.20 y en otras estaciones del mismo peaje también aparece 1.20, es
razonable que sea el mismo fenómeno y que la confirmación se pueda aplicar en
lote.

```sql
CREATE OR REPLACE FUNCTION public.peajes_grupos_similares_tarifa(
  p_tarifa_normalizada_id uuid,
  p_tolerancia numeric DEFAULT 0.01
)
RETURNS TABLE (
  estacion_id uuid,
  estacion_nombre text,
  categoria text,
  ratio numeric,
  niveles integer,
  cases_total integer
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  WITH ref AS (
    SELECT tn.peaje_id, tn.estacion_id, tn.categoria
    FROM public.tarifas_normalizadas tn
    WHERE tn.id = p_tarifa_normalizada_id
  ),
  objetivo AS (
    SELECT
      r.peaje_id,
      r.estacion_id,
      r.categoria,
      max(tn.importe) / NULLIF(min(tn.importe), 0) AS ratio,
      count(DISTINCT tn.importe)::integer          AS niveles
    FROM ref r
    JOIN public.tarifas_normalizadas tn
      ON tn.peaje_id = r.peaje_id
     AND tn.estacion_id = r.estacion_id
     AND tn.categoria IS NOT DISTINCT FROM r.categoria
    GROUP BY r.peaje_id, r.estacion_id, r.categoria
  ),
  candidatos AS (
    SELECT
      tn.estacion_id,
      tn.categoria,
      max(tn.importe) / NULLIF(min(tn.importe), 0) AS ratio,
      count(DISTINCT tn.importe)::integer          AS niveles,
      sum(tn.cases)::integer                       AS cases_total
    FROM public.tarifas_normalizadas tn
    JOIN objetivo o ON o.peaje_id = tn.peaje_id
    WHERE tn.confirmado_manual = false
      AND tn.diagnostico = 'POSIBLE_HORARIO'
      AND NOT (tn.estacion_id = o.estacion_id
               AND tn.categoria IS NOT DISTINCT FROM o.categoria)
    GROUP BY tn.estacion_id, tn.categoria
    HAVING count(DISTINCT tn.importe) >= 2
  )
  SELECT
    c.estacion_id,
    est.nombre AS estacion_nombre,
    c.categoria,
    round(c.ratio, 4) AS ratio,
    c.niveles,
    c.cases_total
  FROM candidatos c
  JOIN objetivo o ON true
  JOIN public.estaciones est ON est.id = c.estacion_id
  WHERE o.ratio IS NOT NULL
    AND abs(c.ratio - o.ratio) <= p_tolerancia * o.ratio
    -- Solo se ofrece el lote si la cantidad de niveles coincide exactamente.
    AND c.niveles = o.niveles
  ORDER BY c.cases_total DESC;
$$;

COMMENT ON FUNCTION public.peajes_grupos_similares_tarifa(uuid, numeric) IS
  'F14-2 · Familias de otras estaciones del mismo peaje con el mismo ratio max/min. Solo válido para familias de 2 niveles (ver limitación documentada).';

REVOKE ALL ON FUNCTION public.peajes_grupos_similares_tarifa(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peajes_grupos_similares_tarifa(uuid, numeric) TO authenticated, service_role;
```

### Limitación documentada: el ratio `max/min` solo describe familias de 2 niveles

Con dos niveles, `max/min` es una descripción **completa** de la familia: hay un
solo grado de libertad y ese número lo captura entero. Con tres o más niveles,
`max/min` describe únicamente los extremos y colapsa información:

```text
Familia P:  100 · 120 · 150      max/min = 1.50
Familia Q:  100 · 145 · 150      max/min = 1.50   ← mismo ratio, patrón distinto
```

Ambas se reportarían como "similares" aunque el nivel intermedio esté en lugares
completamente distintos, y aplicar en lote la asignación de P sobre Q sería
sencillamente incorrecto.

La comparación correcta para N niveles es el **vector de ratios** contra la base
(`[1.00, 1.20, 1.50]` vs `[1.00, 1.45, 1.50]`) con una distancia elemento a
elemento. Eso queda **fuera del MVP**. La mitigación implementada es el filtro
`c.niveles = o.niveles`: para familias de 3+ niveles la función va a devolver
candidatos igual, así que la UI debe **deshabilitar el botón de aplicar en lote
cuando `niveles > 2`** y mostrar el bloque solo como información (Apéndice C).
El agente 01 debe repetir esta advertencia en el doc de backend.

---

## 11. RLS

> **Propuesta a validar con el CLI + `npx supabase db advisors`.** No aplicada.

### 11.1 MVP — patrón plano del repo (esto es lo que se aplica)

Auth/RLS granular está **explícitamente fuera del alcance del MVP** (PRD §5.2 y
`ibarra-app/AGENTS.md` §Stack). Todas las tablas de peajes usan el mismo patrón
plano; ver `20260730125534_peajes_rpc_y_auditoria.sql` líneas 35–44 y
`20260804145440_peajes_plantillas_reconocimiento_estaciones.sql` líneas 20–25.
El control de acceso real vive en el frontend, con el permiso `peajes:read` y el
`PermissionGuard`.

```sql
ALTER TABLE public.tarifas_normalizadas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifas_parametros_peaje   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifas_status_catalogo    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tarifas_normalizadas_authenticated_all ON public.tarifas_normalizadas;
CREATE POLICY tarifas_normalizadas_authenticated_all ON public.tarifas_normalizadas
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tarifas_parametros_peaje_authenticated_all ON public.tarifas_parametros_peaje;
CREATE POLICY tarifas_parametros_peaje_authenticated_all ON public.tarifas_parametros_peaje
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS tarifas_status_catalogo_authenticated_all ON public.tarifas_status_catalogo;
CREATE POLICY tarifas_status_catalogo_authenticated_all ON public.tarifas_status_catalogo
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifas_normalizadas     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifas_parametros_peaje TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifas_status_catalogo  TO authenticated;
GRANT ALL ON public.tarifas_normalizadas     TO service_role;
GRANT ALL ON public.tarifas_parametros_peaje TO service_role;
GRANT ALL ON public.tarifas_status_catalogo  TO service_role;
```

Con RLS habilitada y política permisiva, `SECURITY INVOKER` en todas las
funciones es coherente: la función no puede ver más de lo que ve el usuario que
la llama, y hoy el usuario autenticado ve todo.

### 11.2 Diferido — RLS por empresa y por rol · **NO APLICAR EN MVP**

Se deja el boceto para que la iteración que traiga multi-empresa no tenga que
re-derivarlo. **Este bloque no va en ninguna migración de F14.** Antes de
aplicarlo hacen falta tres cosas que hoy no existen:

1. Un claim `empresa_id` en `app_metadata` del JWT, poblado en el alta de
   usuario. Hoy **no existe**.
2. Un rol de negocio (`analista` / `admin`) resoluble desde la base. Hoy los
   permisos son de aplicación (`GranularPermissionService`), no de base.
3. Resolver el cast: `peajes.empresa_id` es **text** y puede valer
   `'__global__'`, que no es un uuid. Un `::uuid` directo sobre esa columna
   **revienta** en tiempo de ejecución con `invalid input syntax for type uuid`.
   El borrador v2 §28.9 tiene exactamente ese bug.

```sql
-- ⚠️  DIFERIDO — NO APLICAR EN MVP (PRD §5.2). Referencia para una iteración futura.
--
-- CREATE POLICY tarifas_normalizadas_select_empresa ON public.tarifas_normalizadas
--   FOR SELECT TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1
--       FROM public.estaciones e
--       JOIN public.peajes pj ON pj.id = e.peaje_id
--       WHERE e.id = tarifas_normalizadas.estacion_id
--         AND (
--           pj.empresa_id = '__global__'
--           OR pj.empresa_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'empresa_id')
--           --  ↑ comparación TEXT contra TEXT: nunca castear pj.empresa_id a uuid
--         )
--     )
--   );
--
-- CREATE POLICY tarifas_normalizadas_update_analista ON public.tarifas_normalizadas
--   FOR UPDATE TO authenticated
--   USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('analista', 'admin'))
--   WITH CHECK (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('analista', 'admin'));
--
-- CREATE POLICY tarifas_status_catalogo_write_admin ON public.tarifas_status_catalogo
--   FOR ALL TO authenticated
--   USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
--   WITH CHECK (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
```

Notar el `(SELECT auth.jwt())` envuelto en subconsulta: es la forma recomendada
por `supabase-postgres-best-practices` para que el planner lo evalúe una vez y
no por fila.

### 11.3 Advisors

Tras crear tablas y políticas, correr `npx supabase db advisors` y dejar el
resultado como evidencia en `feature_list.json` → F14-1. Los avisos esperables:

- `function_search_path_mutable` sobre las funciones nuevas → agregar
  `SET search_path = ''` y calificar todos los objetos con `public.` (este
  apéndice ya los califica).
- Ningún `rls_disabled_in_public`: las tres tablas la habilitan.

---

## 12. Enganche post-carga

El worker rápido tiene que correr después de cada carga confirmada. Hay dos
formas y hay que elegir una.

```text
Wizard Paso 9 ── PeajesCargaSupabaseService.confirmarCarga()
                              │
                              ▼
                    rpc('peajes_confirmar_carga', …)
                    ┌───────────────────────────────┐
                    │  INSERT documentos            │
                    │  INSERT pasadas (bulk)        │
                    │  INSERT registros_carga_peajes│
                    │  validación RN-13/17          │
                    └───────────────────────────────┘
                              │  COMMIT
                              ▼
      opción (a): adentro, misma TX  │  opción (b): segundo .rpc(), TX aparte
              peajes_normalizar_tarifas(v_documento_id)
```

### Opción (a) — dentro de `peajes_confirmar_carga`, misma transacción

Se agrega al final del cuerpo, antes del `RETURN`:

```sql
-- opción (a)
SELECT * INTO v_norm FROM public.peajes_normalizar_tarifas(v_documento_id);
```

y el resultado se suma al `jsonb` de retorno.

| A favor | En contra |
|---|---|
| Invariante fuerte: no existe una pasada persistida sin pasar por el clasificador | **Un fallo del clasificador tira abajo una carga válida.** Si `peajes_normalizar_tarifas` levanta una excepción (por ejemplo, el trigger de status rechaza algo), se pierde el documento entero |
| Un solo round-trip | Alarga una transacción que ya inserta N pasadas fila por fila en un bucle `FOR` (ver `20260730125534_peajes_rpc_y_auditoria.sql`, líneas 548–578); en importación masiva se hace una llamada **por documento**, y estirarlas todas aumenta la ventana de bloqueo sobre `tarifas_normalizadas` |
| No hay estado intermedio observable | Acopla dos features con ciclos de vida distintos: F01-9 (estable, con tests) y F14-2 (nueva) |

### Opción (b) — segundo `.rpc()` desde el servicio Angular · **RECOMENDADA**

En `PeajesCargaSupabaseService.confirmarCarga()`
(`src/app/components/peajes/services/peajes-carga.service.ts`, líneas 151–177),
después de validar la respuesta y **antes** de armar el objeto de retorno:

```typescript
// Normalización tarifaria (F14-2). No debe invalidar una carga ya confirmada.
try {
  const { data: norm, error: normError } = await client.rpc('peajes_normalizar_tarifas', {
    p_documento_id: documentoId,
  });
  if (normError) throw normError;
  normalizacion = Array.isArray(norm) ? (norm[0] ?? null) : (norm ?? null);
} catch (e) {
  console.warn('[peajes] normalización tarifaria diferida', e);
  normalizacion = null;
}
```

| A favor | En contra |
|---|---|
| **Aislamiento de fallas.** La carga ya está commiteada; un error de normalización no la revierte | Ventana en la que existen pasadas con `tarifa_normalizada_id IS NULL` |
| La transacción de `peajes_confirmar_carga` no cambia: F01-9 y sus tests quedan intactos | Dos round-trips |
| Permite mostrar el resumen "N pasadas clasificadas / M niveles nuevos" como información **adicional**, no como condición de éxito | El manejo del error queda del lado del cliente |

**Se recomienda la opción (b).** El criterio decisivo es que *una carga válida no
puede perderse por un fallo del clasificador*: la carga es el dato primario y la
clasificación es un derivado reconstruible en cualquier momento con
`peajes_recalcular_tarifas`. La ventana de pasadas sin clasificar es
intrascendente justamente por eso.

Que el agente 01 sea dueño tanto del SQL (`supabase/migrations/*peajes*`) como de
la implementación del servicio Angular
(`src/app/components/peajes/**/services/*.service.ts`, según la tabla de alcance
de `ibarra-app/AGENTS.md`) hace que la opción (b) **no** cueste una coordinación
extra entre agentes: los dos archivos están en su alcance exclusivo. Si el
enganche cayera en manos del agente 02, el cálculo sería otro.

### Contrato de manejo de errores (vale para las dos opciones)

| Situación | Comportamiento exigido |
|---|---|
| `peajes_normalizar_tarifas` lanza excepción | Opción (b): se registra y se sigue; `confirmarCarga` devuelve éxito con `normalizacion: null`. Opción (a): la carga completa hace rollback y el usuario ve el error de la carga |
| Documento de tipo `NC` | La función devuelve `(0, 0)` sin error. La UI no muestra resumen de normalización |
| Documento inexistente | La función lanza excepción. En opción (b) no puede pasar: el id viene del `RETURNING` del insert |
| Resultado parcial | No existe: la función es una sola transacción |

**Prohibido** hacer `SELECT` de verificación después del commit para "confirmar"
que la normalización corrió. Es la misma trampa que documenta
`peajes-carga.service.ts` líneas 176–178 y `docs/backend/peajes/confirmar-carga.md`:
un fallo de lectura convertiría un commit exitoso en un falso error y llevaría al
usuario a reimportar duplicados.

### Dependencia con Paso 5

Para que el worker tenga algo que clasificar en Patrón B,
`peajes_confirmar_carga` debe **persistir `categoria`** en el insert de
`pasadas`. Eso implica leer `v_pasada->>'categoria'` en el bucle de inserción y
que el payload `p_pasadas` la traiga desde el wizard. La trazabilidad completa
del valor (columna del Excel → `MapeoColumna` → `construirPasadasDesdeMapeo()`
→ `PasadaEstandarizada` → `p_pasadas` → `pasadas.categoria`) está en el
**Apéndice B §5**. El cambio en el cuerpo del RPC es de F14-2 (agente 01); el
contrato `PasadaColumnKey` es de F14-0 (agente 00) y es un prerrequisito duro.

---

## 13. Vistas a actualizar y auditoría

`pasadas` gana tres columnas, así que toda vista que haga `SELECT p.*` o enumere
columnas de `pasadas` hay que revisarla. Estado verificado en DESARROLLO:

| Vista | Situación | Acción |
|---|---|---|
| `pasadas_con_peaje` | Expone las 13 columnas de `pasadas` + `peaje_id`, `estacion_nombre`, `peaje_nombre` | Recrear sumando `categoria`, `tarifa_normalizada_id`, `tarifa_status` |
| `pasadas_gestion` | Vista principal de la pantalla de gestión. **Ya expone `patente_categoria`** (la categoría interna de `patentes`) | Recrear sumando las tres nuevas. **Cuidado con el nombre**: la columna nueva debe llamarse `categoria` (o `pasada_categoria` si hace falta desambiguar en la UI), nunca `patente_categoria` |
| `pwbi_pasadas` | Vista de Power BI, con nombres en PascalCase y `Patente_Categoria` | Recrear sumando `Categoria`, `Tarifa_Normalizada_ID`, `Tarifa_Status` siguiendo la convención de nombres de esa vista |
| `pwbi_documentos` | No toca columnas de `pasadas` | Revisar; probablemente sin cambios |
| `pwbi_estacion` | No toca columnas de `pasadas` | Revisar; probablemente sin cambios |
| `pwbi_patentes` | No toca columnas de `pasadas` | Revisar; probablemente sin cambios |

Procedimiento obligado: `CREATE OR REPLACE VIEW` **no** admite agregar columnas
en el medio ni reordenar. Hay que `DROP VIEW … CASCADE` en orden de dependencia
y recrear, o agregar las columnas **al final** del `SELECT`. Antes de escribir la
migración, extraer la definición vigente:

```sql
-- Solo lectura, para copiar la definición actual antes de modificarla.
SELECT viewname, pg_get_viewdef(('public.' || viewname)::regclass, true)
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('pasadas_con_peaje','pasadas_gestion','pwbi_pasadas',
                   'pwbi_documentos','pwbi_estacion','pwbi_patentes');
```

**Riesgo concreto de confusión (RN-15).** `pasadas_gestion.patente_categoria`
viene de `patentes.categoria` y es el enum interno
(`TRANSPORTE | REMIS | OBRA | AUTO`). `pasadas.categoria` es texto crudo del
proveedor, sin catálogo, sin FK y sin relación con el anterior. Un archivo puede
traer `CATEGORIA = '5'` en una pasada cuya patente es `TRANSPORTE`. La vista
tiene que exponer las dos y la documentación de F14-5 debe decirlo explícito,
porque es el error de interpretación más probable de toda la épica.

### `registros_carga_peajes`

La tabla de auditoría **no cambia de esquema**. Su FK es `documento_id` y tiene
`nombre_archivo`. Con la opción (b) de §12 la normalización ocurre fuera de la
transacción de carga, así que el registro de auditoría **no** refleja el
resultado de la normalización.

Si se quisiera dejar rastro (por ejemplo, `parametros_efectivos` con
`{"normalizacion": {"pasadas_matcheadas": …, "grupos_nuevos": …}}`), habría que
hacer un `UPDATE` del registro después del segundo RPC, lo que reintroduce una
escritura post-commit. **Recomendación: no hacerlo en el MVP.** La trazabilidad
de qué se clasificó y cuándo ya está en `tarifas_normalizadas.updated_at` y en
`pasadas.tarifa_normalizada_id`. Registrar la decisión en el doc de backend.

---

## 14. Orden de implementación

Checklist para el **agente 01**. Marcar en este archivo o en
`docs/claude-progress.md`; el estado canónico va en `feature_list.json`.

### F14-1 — Tablas, ALTER, índices y RLS

- [ ] 1. Confirmar prerrequisito: **F14-0 cerrada** (`'CATEGORIA'` en
      `PasadaColumnKey`, agente 00). Sin eso, el wizard no puede mandar el valor
      y la feature queda sin datos de Patrón B.
      → `git log --oneline -5` y revisar `models/peajes.types.ts`.
- [ ] 2. Verificar que el CLI local corre PostgreSQL ≥ 15
      (`UNIQUE NULLS NOT DISTINCT`).
      → `npx supabase start` y `npx supabase status`; DESARROLLO ya está en 17.6.
- [ ] 3. Migración 1: `tarifas_parametros_peaje`, `tarifas_status_catalogo`,
      `tarifas_normalizadas`, `peajes_validar_status_tarifa()` +
      `trg_validar_status_tarifa`, índices, RLS, grants, comentarios (§3, §11.1).
      → `npx supabase db reset --local --no-seed`
- [ ] 4. Migración 2: `ALTER TABLE pasadas` + índices (§4).
      → `npx supabase db reset --local --no-seed`
- [ ] 5. Advisors sobre lo creado hasta acá.
      → `npx supabase db advisors` (guardar salida como evidencia F14-1)

### F14-2 — RPCs

- [ ] 6. Migración 3: `peajes_normalizar_tarifas` y
      `peajes_recalcular_tarifas` (§5, §6).
      → `npx supabase db reset --local --no-seed && npx supabase test db`
- [ ] 7. Migración 4: `peajes_confirmar_status_tarifa`,
      `peajes_marcar_diagnostico_tarifa`, `peajes_grupos_similares_tarifa`
      (§7, §8, §10).
      → `npx supabase test db`
- [ ] 8. Migración 5: `peajes_listar_tarifas_normalizadas` (§9). Medir el
      `EXPLAIN ANALYZE` de la variante con tabla temporal contra la variante
      duplicada y dejar la decisión escrita.
      → `npx supabase test db`
- [ ] 9. Migración 6: recreación de vistas (§13). Extraer primero las
      definiciones vigentes con `pg_get_viewdef`.
      → `npx supabase db reset --local --no-seed`
- [ ] 10. Modificar `peajes_confirmar_carga` para persistir
      `v_pasada->>'categoria'` en el insert de `pasadas` (§12, Apéndice B §5).
      → `npx supabase test db` (la suite de F01/F13 tiene que seguir verde)
- [ ] 11. Implementar el segundo `.rpc()` en
      `PeajesCargaSupabaseService.confirmarCarga()` con el manejo de errores
      del contrato de §12.
      → `npx ng test --include="**/peajes/**/*carga*.spec.ts" --watch=false --browsers=ChromeHeadless`
      → `npx tsc --noEmit -p tsconfig.app.json`
- [ ] 12. Advisors final + build.
      → `npx supabase db advisors` · `npm run build`

### Cierre

- [ ] 13. Documentar en `docs/backend/peajes/` (una página por RPC + entradas de
      índice). Es **F14-5, agente 04**: el agente 01 deja el contrato exacto en
      `docs/session-handoff.md`, no escribe la doc.
- [ ] 14. Actualizar `feature_list.json` (F14-1, F14-2) con comando y resultado,
      y agregar entrada en `docs/claude-progress.md`.
- [ ] 15. `db push --linked` a DESARROLLO **solo con autorización explícita del
      usuario**, después de `--dry-run`. Ojo con la deriva:
      `20260811190002_peajes_algoritmo_filtrar_columna.sql` está en el repo y no
      en el remoto, así que va a viajar en el mismo push.
- [ ] 16. Ya en DESARROLLO, correr `peajes_recalcular_tarifas` una vez por peaje
      con pasadas y verificar que
      `SELECT count(*) FROM pasadas WHERE tarifa_normalizada_id IS NULL` da 0 o
      un número explicable (pasadas de documentos NC o con `precio <= 0`).

---

## 15. Riesgos SQL

### 15.1 `stddev_pop` con una sola fila devuelve 0, no NULL

Verificado en DESARROLLO:

| Expresión | Resultado |
|---|---|
| `stddev_pop(x)` sobre una fila | `0` |
| `stddev_samp(x)` sobre una fila | `NULL` |
| `stddev_pop(x)` sobre `generate_series(0,23)` | `6.9221865524317290` |

El borrador v2 asume que un grupo de una sola pasada deja `desvio IS NULL` y que
la rama `cf.desvio IS NULL` del `CASE` lo captura. **Es falso.** Como el
`GROUP BY` garantiza al menos una fila por grupo, `stddev_pop` nunca devuelve
NULL en estas consultas: un nivel con una sola pasada tiene `desvio = 0`, que es
el valor **más bajo posible** y por lo tanto el más "concentrado en franja
horaria" según el criterio de §6.1. Sin protección, cada tarifa vista una sola
vez se clasificaría como `POSIBLE_HORARIO` y la cola de revisión se llenaría de
ruido.

**Mitigación implementada:** `cases < v_umbral_muestra` es la **primera** rama
del `CASE` de §6.2. Cualquier grupo con menos de 15 pasadas (default) sale como
`MUESTRA_INSUFICIENTE` antes de que el desvío se mire siquiera. La rama
`cf.desvio IS NULL` se conserva por defensa en profundidad, no porque se espere
que ocurra.

**Caso de prueba obligatorio (Apéndice D):** un nivel con exactamente 1 pasada
debe salir `MUESTRA_INSUFICIENTE`, nunca `POSIBLE_HORARIO`.

### 15.2 Zona horaria de `extract(hour from fecha_hora)` — trampa de correctitud

`pasadas.fecha_hora` es `timestamptz`. En PostgreSQL, `extract(hour from
<timestamptz>)` **no** es determinista por sí solo: convierte el instante a la
zona de la sesión (`TimeZone`) y recién ahí extrae la hora. Dos clientes con
distinta configuración obtienen números distintos sobre la misma fila. Para un
análisis de hora pico eso no es un detalle: un corrimiento de 3 horas mueve el
pico de la mañana al medio de la madrugada y arruina la clasificación entera.

Estado verificado en DESARROLLO:

| Dato | Valor |
|---|---|
| `current_setting('TimeZone')` del proyecto | **`UTC`** |
| Cómo llega la fecha desde el wizard | `toPostgresFechaHora()` (`wizard/services/peajes-fecha.util.ts`, líneas 6–50) devuelve `yyyy-MM-dd HH:mm:ss` **sin offset**: es la hora de pared que traía el archivo del proveedor |
| Cómo la interpreta Postgres | Como está en la zona de sesión (UTC) → el instante almacenado es "hora de pared del proveedor, etiquetada UTC" |
| Cómo la muestra la UI | `formatUtcDateTime()` (mismo archivo, líneas 85–102) fuerza los getters UTC, es decir, vuelve a mostrar la hora de pared original |

**Conclusión: la zona correcta para el análisis es `UTC`, no
`America/Argentina/Buenos_Aires`.** Suena contraintuitivo, pero es lo coherente
con cómo el dato entra y cómo se muestra. Aplicar
`AT TIME ZONE 'America/Argentina/Buenos_Aires'` restaría 3 horas a un valor que
**ya es** la hora local del proveedor, y una pasada de las 08:00 pasaría a
contarse como de las 05:00.

**Prueba empírica (DESARROLLO `kfffigvyvtzyczeiadxh`, 2026-08-12).** Sobre
`ZARATE - RUTA 9 KM. 95`, se recalculó `stddev_pop` de la hora del día con
`AT TIME ZONE 'UTC'` y con `AT TIME ZONE 'America/Argentina/Buenos_Aires'`, y se
comparó contra la columna `Desvío horario` del CSV de referencia:

| Importe | Casos DB | Desvío CSV | Desvío UTC | Desvío BA |
|---|---:|---:|---:|---:|
| 1500 | 89 (CSV 114) | 7,49 | 7,02 | 6,95 |
| 3000 | 20 | 4,73 | 4,74 | 4,74 |
| 4500 | 35 | 6,40 | 6,35 | 5,27 |
| 6000 | 355 | 5,98 | 5,99 | 5,84 |
| 7500 | 189 | 7,24 | 7,25 | 6,95 |

**4 de 5 niveles coinciden con UTC ±0,01.** Con Buenos Aires el nivel 4500 se
desvía 1,13 h y el pico del mediodía se desplaza a una falsa hora pico de
7–8 a. m. Usar la zona local sin pin explícito es un **bug silencioso**: el
código compila, los números se ven plausibles y el diagnóstico horario queda
errado. La diferencia de casos en 1500 (CSV 114 vs DB 89) se explica por el
hueco 1040→1015 (§15.3), no por la zona.

Si más adelante la ingesta del wizard guarda offsets reales (`-03:00`), esta
decisión se revisa (punto 2 abajo).

Por eso todas las expresiones de §5 y §6 son explícitas:

```sql
extract(hour   FROM p.fecha_hora AT TIME ZONE 'UTC')
+ extract(minute FROM p.fecha_hora AT TIME ZONE 'UTC') / 60.0
```

`AT TIME ZONE 'UTC'` convierte el `timestamptz` a `timestamp` sin zona en UTC, y
sobre ese valor `extract` es determinista sin importar la sesión. Lo que se
prohíbe no es una zona en particular: es **omitir la zona**.

Tres consecuencias operativas:

1. **No hay índice de expresión posible.** `timestamptz AT TIME ZONE text` es
   `STABLE`, no `IMMUTABLE` (depende de la base de datos de zonas horarias), así
   que no se puede indexar la hora del día. Las agregaciones hacen scan del
   conjunto ya filtrado por peaje/documento, lo cual es aceptable al volumen
   actual.
2. **Si algún día se corrige la ingesta** para guardar el offset real del
   proveedor (`-03:00`), esta decisión se invierte y hay que pasar a
   `AT TIME ZONE 'America/Argentina/Buenos_Aires'` **y** recalcular todo. Dejar
   la nota en el doc de backend para que quien haga ese cambio sepa que arrastra
   a F14.
3. **Extraer la expresión a un helper.** Repetirla ocho veces entre §5 y §6 es
   pedirle a alguien que la modifique en siete lugares. Se propone:

```sql
CREATE OR REPLACE FUNCTION peajes_private.hora_del_dia(p_fecha_hora timestamptz)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT extract(hour   FROM p_fecha_hora AT TIME ZONE 'UTC')
       + extract(minute FROM p_fecha_hora AT TIME ZONE 'UTC') / 60.0;
$$;

COMMENT ON FUNCTION peajes_private.hora_del_dia(timestamptz) IS
  'F14 · Hora del día 0-23.99 en UTC. UTC es la zona correcta porque la ingesta guarda la hora de pared del proveedor sin offset (ver Apéndice A §15.2).';
```

Va en `peajes_private` (esquema ya existente, no expuesto por PostgREST). El
agente 01 debe medir si el llamado por fila degrada el plan frente a la
expresión inline; si degrada, se queda la expresión repetida **con el comentario
de esta sección copiado arriba de cada consulta**.

### 15.3 Importes negativos de notas de crédito

`documentos.tipo` ∈ {`FC`, `NC`} y las NC guardan importes **con signo
negativo** en cabecera y líneas
(`docs/backend/peajes/confirmar-carga.md`, sección *Business Logic*, punto 2).
Una NC produce filas en `pasadas` con `precio` negativo.

Si esas filas entraran a la agregación pasarían tres cosas malas:

1. Se crearían niveles de tarifa con `importe` negativo, que no representan
   ninguna tarifa real.
2. `importe_base = min(importe)` de la familia pasaría a ser el valor negativo,
   y todos los `multiplicador` de esa estación quedarían negativos y sin
   sentido.
3. El `CHECK (importe > 0)` de §3.3 haría fallar el `INSERT` y, en la opción (a)
   de §12, tiraría abajo la carga entera.

**Mitigación: doble filtro.**

- `JOIN documentos d ON d.id = p.documento_id AND d.tipo = 'FC'` en el recálculo
  (§6.2) y corte temprano por tipo en el worker (§5).
- `AND p.precio > 0` en ambas, como red de seguridad ante ajustes o correcciones
  manuales que dejen un precio no positivo en un documento FC.

Estado actual en DESARROLLO: **0 pasadas** asociadas a documentos `NC` (y
`precio < 0` = 0 en toda la tabla). El filtro hoy no cambia ningún resultado
sobre lo cargado; hay que dejarlo puesto desde el principio y cubrirlo con
datos sintéticos en el CLI local (Apéndice D, caso `B-11`).

**Hueco 1040→1015 localizado (evidencia fuerte, no prueba cerrada).** Toda la
diferencia de 25 filas entre el libro `ConsumosResumen.xlsx` (1040 filas en
`RESULTADO_1`) y las 1015 pasadas con ese `file_upload_name` cae en un solo
nivel: `ZARATE - RUTA 9 KM. 95` a precio 1500 (CSV 114 vs DB 89). El archivo
`scripts/telepeaje plus/202607-2/resumen.txt` indica
`Todas subidas menos 0104-00077675 NC`: evidencia fuerte de que la NC
`0104-00077675` **nunca se subió** al wizard. Sin abrir el xlsx no se prueba al
100 %, pero localiza el hueco fuera de las FC cargadas y refuerza el filtro
`documentos.tipo = 'FC'` + `precio > 0`.

**Decisión de MVP (cerrada para F14):** las NC se **ignoran** en el análisis
tarifario. No se restan casos del nivel correspondiente. Si más adelante el
product owner pide que una NC anule pasadas facturadas de más, hace falta una
columna `cases_anulados` y cambia el modelo: **no implementar eso sin
confirmación escrita.**

### 15.4 `UNIQUE NULLS NOT DISTINCT` requiere PostgreSQL 15+

DESARROLLO corre 17.6, así que no hay problema del lado remoto. El riesgo está
en el CLI local: si la imagen de Postgres del `supabase/config.toml` fuera
anterior a 15, la migración de §3 falla en el primer `db reset` con un error de
sintaxis poco descriptivo. Verificarlo en el paso 2 de §14.

No hay alternativa razonable. El sustituto clásico —un índice único sobre
`coalesce(categoria, '\_\_NULL\_\_')`— reintroduce un valor centinela mágico en los
datos, rompe el `ON CONFLICT` (que necesita una restricción, no un índice de
expresión arbitraria, para la sintaxis por columnas) y obliga a filtrar el
centinela en todas las lecturas. Si por algún motivo hubiera que soportar
Postgres 14, es preferible discutir el diseño de vuelta antes que meter el
centinela.

### 15.5 `pg_cron` y `pg_net` no están instalados

El borrador v2 §28.10 punto 11 propone programar el recálculo con `pg_cron`. Esa
extensión **no está instalada** en DESARROLLO, y habilitarla es una decisión de
infraestructura que excede a F14.

Para el MVP, `peajes_recalcular_tarifas(p_peaje_id)` se dispara **manualmente**
desde el botón *Recalcular* de la pantalla de auditoría (Apéndice C). Es
idempotente, así que ejecutarlo de más no rompe nada.

Si más adelante se quisiera automatizar, la secuencia sería: habilitar la
extensión (`CREATE EXTENSION IF NOT EXISTS pg_cron;` con los privilegios
correspondientes), decidir la frecuencia y recién entonces:

```sql
-- ⚠️  DIFERIDO — requiere instalar pg_cron primero. NO incluir en las migraciones de F14.
-- SELECT cron.schedule(
--   'peajes_recalcular_tarifas_diario',
--   '0 4 * * *',
--   $$ SELECT public.peajes_recalcular_tarifas(id) FROM public.peajes $$
-- );
```

Ojo con eso último: recorrer todos los peajes en un solo job serializa el
recálculo y, con `SECURITY INVOKER`, correría con el rol del cron, no con el de
un usuario autenticado. Habría que revisar la RLS antes.

### 15.6 Otros riesgos menores

| Riesgo | Mitigación |
|---|---|
| `round(numeric, int)` sobre el resultado de `avg()`/`stddev_pop()` — devuelven `numeric` para entrada `numeric`, pero `extract` devuelve `numeric` en PG 14+ y `double precision` en versiones viejas | La expresión de §15.2 fuerza `numeric` al dividir por `60.0`. Igual, verificar los tipos en el primer `db reset` |
| Concurrencia: dos cargas simultáneas del mismo peaje pueden pelear por el mismo `ON CONFLICT` | PostgreSQL lo resuelve con el índice único; una de las dos espera. Al volumen actual es irrelevante |
| `multiplicador` con `importe_base = 0` | `NULLIF(importe_base, 0)` en la división → `multiplicador` NULL. Pero el `CHECK (importe > 0)` hace que `importe_base` nunca pueda ser 0, así que la rama es defensiva |
| Borrar un peaje con niveles de tarifa | `ON DELETE RESTRICT` en `tarifas_normalizadas.peaje_id` lo impide. Es deliberado: borrar una concesión con historial tarifario debe ser una operación consciente |
| El `DO UPDATE` de §5 no refresca `desvio`/`hora_*` | Correcto y deliberado: el worker rápido solo ve un documento y sus estadísticas serían sesgadas. `peajes_recalcular_tarifas` es el que las corrige con la foto completa |

---

> Última actualización: 2026-08-12
