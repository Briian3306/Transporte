# Conectar Power BI a Supabase por API (URL + anon key)

## Resumen

Conexión **solo con Data API (PostgREST)**: no hace falta host Postgres ni password de base de datos. En Power BI usás la **URL del proyecto** y la **anon key**.

Proyecto: **DESARROLLO** `SUPABASE_URL` (Check-list).

## Índice

- [Resumen](#resumen)
- [Credenciales](#credenciales)
- [Endpoints de las vistas `pwbi_*`](#endpoints-de-las-vistas-pwbi_)
- [Pasos en Power BI Desktop (Web)](#pasos-en-power-bi-desktop-web)
- [Power Query M (recomendado)](#power-query-m-recomendado)
- [Tipos de columnas (obligatorio)](#tipos-de-columnas-obligatorio)
- [Paginación (>1000 filas)](#paginación-1000-filas)
- [Relaciones en el modelo](#relaciones-en-el-modelo)
- [Prerrequisito de permisos (anon + RLS)](#prerrequisito-de-permisos-anon--rls)
- [Troubleshooting](#troubleshooting)
- [Seguridad](#seguridad)
- [Referencias](#referencias)

## Credenciales

Fuente: Supabase MCP (`get_project_url`, `get_publishable_keys`).

| Campo | Valor |
|-------|--------|
| Project ref | `SUPABASE_URL` |
| **Supabase URL** | `https://SUPABASE_URL.supabase.co` |
| **anon key** (legacy JWT) | ver bloque abajo |
| REST base | `https://SUPABASE_URL.supabase.co/rest/v1` |

```text
SUPABASE_KEY
```

Headers obligatorios en cada request:

```http
apikey: <anon_key>
Authorization: Bearer <anon_key>
```

**No** usar `service_role` en Power BI.

## Endpoints de las vistas `pwbi_*`

| Vista | Rol | URL |
|-------|-----|-----|
| `pwbi_estacion` | Dimensión | `https://SUPABASE_URL.supabase.co/rest/v1/pwbi_estacion?select=*` |
| `pwbi_patentes` | Dimensión | `https://SUPABASE_URL.supabase.co/rest/v1/pwbi_patentes?select=*` |
| `pwbi_documentos` | Dimensión | `https://SUPABASE_URL.supabase.co/rest/v1/pwbi_documentos?select=*` |
| `pwbi_tarifas` | Dimensión | `https://SUPABASE_URL.supabase.co/rest/v1/pwbi_tarifas?select=*` |
| `pwbi_pasadas` | Hecho | `https://SUPABASE_URL.supabase.co/rest/v1/pwbi_pasadas?select=*` |

Detalle de columnas: [pwbi-views.md](../backend/peajes/pwbi-views.md).

Query params útiles:

| Param | Ejemplo | Uso |
|-------|---------|-----|
| `select` | `*` o columnas | proyección |
| `limit` | `1000` | tope por request (default PostgREST suele ser 1000) |
| `offset` | `0` | paginación |
| `order` | `fecha_hora.desc` | orden |

## Pasos en Power BI Desktop (Web)

1. **Obtener datos** → **Web**.
2. Elegí **Avanzado**.
3. **URL de las partes:**
   - `https://SUPABASE_URL.supabase.co/rest/v1/pwbi_estacion?select=*`
4. **Encabezados de solicitud HTTP:**

| Nombre del encabezado | Valor |
|-----------------------|--------|
| `apikey` | *(anon key)* |
| `Authorization` | `Bearer *(anon key)*` |

5. Aceptá → Power Query abre JSON (lista de records).
6. Convertí a tabla: clic derecho en lista → **Convertir en tabla** → expandí las columnas del record.
7. Repetí para `pwbi_patentes`, `pwbi_documentos`, `pwbi_tarifas` y `pwbi_pasadas`.
8. **Cerrar y aplicar**.

Autenticación del origen Web: si Power BI pide credenciales del origen, usá **Anónimo** (la auth va en los headers `apikey` / `Authorization`, no en el diálogo de usuario/contraseña).

## Power Query M (recomendado)

PostgREST / Supabase limita **1000 filas por request** (`max_rows`). Para `pwbi_pasadas` (~3500+) usá **paginación**. Para catálogos chicos (`pwbi_estacion`, `pwbi_patentes`, `pwbi_documentos`, `pwbi_tarifas` ~300 filas) alcanza una sola página.

El JSON de la Data API **no trae tipos**: fechas llegan como texto ISO, UUID como texto, importes a veces como `Any`. Sin `Table.TransformColumnTypes` Power BI no suma, no filtra por fecha ni relaciona bien. Pegá las consultas de abajo **completas** (incluye tipos en todas las columnas). Cultura `"en-US"`: el JSON usa punto decimal e ISO-8601.

### Tipos de columnas (obligatorio)

| Postgres / vista | Power Query | Ejemplo |
|------------------|-------------|---------|
| `uuid` | `type text` | `Pasada_ID`, `Estacion_ID` |
| `text` | `type text` | `Peaje_Nombre`, `Status`, `Tarifa_Status` |
| `timestamptz` | `type datetimezone` | `fecha_hora`, `created_at` |
| `date` | `type date` | `fecha_factura` |
| `numeric` | `type number` | `precio`, `importe_neto`, `Latitud`, `Hora_Min` |
| `integer` / `smallint` | `Int64.Type` | `quantity`, `Cases`, `Categoria_Calculated` |
| `boolean` | `type logical` | `Muestra_Confiable`, `Confirmado_Manual`, `Categoria_Calculated_Boolean` |

`ExpandRecordColumn` lista las columnas **por nombre** (no uses `Record.FieldNames` de la primera fila: si esa fila omite un null, falta la columna).

### `pwbi_pasadas` (paginado + tipos — pegar completo)

```powerquery
let
    SupabaseUrl = "https://SUPABASE_URL.supabase.co",
    AnonKey = "SUPABASE_KEY",
    Resource = "pwbi_pasadas",
    PageSize = 1000,
    Headers = [
        apikey = AnonKey,
        Authorization = "Bearer " & AnonKey
    ],
    Cols = {
        "Pasada_ID", "fecha_hora", "Pase_ID", "Patente_ID", "Estacion_ID", "Documento_ID",
        "Peaje_ID", "Empresa_ID", "precio", "bonificacion", "quantity", "importe_neto",
        "Categoria", "Categoria_Calculated", "Categoria_Calculated_Boolean",
        "Tarifa_Normalizada_ID", "Tarifa_Status", "created_at", "user_id",
        "file_upload_name", "Estacion_Nombre", "Estacion_Geocodificacion_Status",
        "Estacion_Latitud", "Estacion_Longitud", "Peaje_Nombre", "Empresa_Nombre",
        "Patente", "Patente_Categoria", "Patente_Tipo_Trabajo", "Patente_Activa", "Pase", "Documento_Numero", "Documento_Tipo",
        "Documento_Cuenta", "fecha_factura", "Documento_Importe_Sin_Iva", "Documento_Importe_Total"
    },
    GetPage = (offset as number) as list =>
        Json.Document(
            Web.Contents(
                SupabaseUrl,
                [
                    RelativePath = "rest/v1/" & Resource,
                    Query = [
                        select = "*",
                        limit = Text.From(PageSize),
                        offset = Text.From(offset),
                        order = "fecha_hora"
                    ],
                    Headers = Headers
                ]
            )
        ),
    Pages = List.Generate(
        () => [Offset = 0, Data = GetPage(0)],
        each List.Count([Data]) > 0,
        each
            let
                NextOffset = [Offset] + PageSize
            in
                [Offset = NextOffset, Data = GetPage(NextOffset)],
        each [Data]
    ),
    Origen = List.Combine(Pages),
    AsTable = Table.FromList(Origen, Splitter.SplitByNothing(), {"Row"}),
    Expanded = Table.ExpandRecordColumn(AsTable, "Row", Cols, Cols),
    Typed = Table.TransformColumnTypes(
        Expanded,
        {
            {"Pasada_ID", type text},
            {"fecha_hora", type datetimezone},
            {"Pase_ID", type text},
            {"Patente_ID", type text},
            {"Estacion_ID", type text},
            {"Documento_ID", type text},
            {"Peaje_ID", type text},
            {"Empresa_ID", type text},
            {"precio", type number},
            {"bonificacion", type number},
            {"quantity", Int64.Type},
            {"importe_neto", type number},
            {"Categoria", type text},
            {"Categoria_Calculated", Int64.Type},
            {"Categoria_Calculated_Boolean", type logical},
            {"Tarifa_Normalizada_ID", type text},
            {"Tarifa_Status", type text},
            {"created_at", type datetimezone},
            {"user_id", type text},
            {"file_upload_name", type text},
            {"Estacion_Nombre", type text},
            {"Estacion_Geocodificacion_Status", type text},
            {"Estacion_Latitud", type number},
            {"Estacion_Longitud", type number},
            {"Peaje_Nombre", type text},
            {"Empresa_Nombre", type text},
            {"Patente", type text},
            {"Patente_Categoria", type text},
            {"Patente_Tipo_Trabajo", type text},
            {"Patente_Activa", type logical},
            {"Pase", type text},
            {"Documento_Numero", type text},
            {"Documento_Tipo", type text},
            {"Documento_Cuenta", type text},
            {"fecha_factura", type date},
            {"Documento_Importe_Sin_Iva", type number},
            {"Documento_Importe_Total", type number}
        },
        "en-US"
    )
in
    Typed
```

### `pwbi_estacion` (tipos)

```powerquery
let
    SupabaseUrl = "https://SUPABASE_URL.supabase.co",
    AnonKey = "SUPABASE_KEY",
    Resource = "pwbi_estacion",
    Headers = [
        apikey = AnonKey,
        Authorization = "Bearer " & AnonKey
    ],
    Cols = {
        "Estacion_ID", "Estacion_Nombre", "Peaje_ID", "Peaje_Nombre",
        "Ubicacion", "Latitud", "Longitud", "Status", "created_at"
    },
    Origen = Json.Document(
        Web.Contents(
            SupabaseUrl,
            [
                RelativePath = "rest/v1/" & Resource,
                Query = [select = "*", limit = "1000"],
                Headers = Headers
            ]
        )
    ),
    AsTable = Table.FromList(Origen, Splitter.SplitByNothing(), {"Row"}),
    Expanded = Table.ExpandRecordColumn(AsTable, "Row", Cols, Cols),
    Typed = Table.TransformColumnTypes(
        Expanded,
        {
            {"Estacion_ID", type text},
            {"Estacion_Nombre", type text},
            {"Peaje_ID", type text},
            {"Peaje_Nombre", type text},
            {"Ubicacion", type text},
            {"Latitud", type number},
            {"Longitud", type number},
            {"Status", type text},
            {"created_at", type datetimezone}
        },
        "en-US"
    )
in
    Typed
```

### `pwbi_patentes` (tipos)

```powerquery
let
    SupabaseUrl = "https://SUPABASE_URL.supabase.co",
    AnonKey = "SUPABASE_KEY",
    Resource = "pwbi_patentes",
    Headers = [
        apikey = AnonKey,
        Authorization = "Bearer " & AnonKey
    ],
    Cols = {"Patente_ID", "Patente", "Patente_Categoria", "Patente_Tipo_Trabajo", "Patente_Activa", "created_at"},
    Origen = Json.Document(
        Web.Contents(
            SupabaseUrl,
            [
                RelativePath = "rest/v1/" & Resource,
                Query = [select = "*", limit = "1000"],
                Headers = Headers
            ]
        )
    ),
    AsTable = Table.FromList(Origen, Splitter.SplitByNothing(), {"Row"}),
    Expanded = Table.ExpandRecordColumn(AsTable, "Row", Cols, Cols),
    Typed = Table.TransformColumnTypes(
        Expanded,
        {
            {"Patente_ID", type text},
            {"Patente", type text},
            {"Patente_Categoria", type text},
            {"Patente_Tipo_Trabajo", type text},
            {"Patente_Activa", type logical},
            {"created_at", type datetimezone}
        },
        "en-US"
    )
in
    Typed
```

### `pwbi_documentos` (tipos)

```powerquery
let
    SupabaseUrl = "https://SUPABASE_URL.supabase.co",
    AnonKey = "SUPABASE_KEY",
    Resource = "pwbi_documentos",
    Headers = [
        apikey = AnonKey,
        Authorization = "Bearer " & AnonKey
    ],
    Cols = {
        "Documento_ID", "Documento_Numero", "Documento_Tipo", "Documento_Cuenta",
        "Empresa_ID", "Empresa_Nombre", "fecha_factura", "Documento_Importe_Sin_Iva",
        "Documento_Bonificacion", "Documento_Percepciones", "Documento_Iva",
        "Documento_Importe_Total", "created_at"
    },
    Origen = Json.Document(
        Web.Contents(
            SupabaseUrl,
            [
                RelativePath = "rest/v1/" & Resource,
                Query = [select = "*", limit = "1000"],
                Headers = Headers
            ]
        )
    ),
    AsTable = Table.FromList(Origen, Splitter.SplitByNothing(), {"Row"}),
    Expanded = Table.ExpandRecordColumn(AsTable, "Row", Cols, Cols),
    Typed = Table.TransformColumnTypes(
        Expanded,
        {
            {"Documento_ID", type text},
            {"Documento_Numero", type text},
            {"Documento_Tipo", type text},
            {"Documento_Cuenta", type text},
            {"Empresa_ID", type text},
            {"Empresa_Nombre", type text},
            {"fecha_factura", type date},
            {"Documento_Importe_Sin_Iva", type number},
            {"Documento_Bonificacion", type number},
            {"Documento_Percepciones", type number},
            {"Documento_Iva", type number},
            {"Documento_Importe_Total", type number},
            {"created_at", type datetimezone}
        },
        "en-US"
    )
in
    Typed
```

### `pwbi_tarifas` (tipos)

```powerquery
let
    SupabaseUrl = "https://SUPABASE_URL.supabase.co",
    AnonKey = "SUPABASE_KEY",
    Resource = "pwbi_tarifas",
    Headers = [
        apikey = AnonKey,
        Authorization = "Bearer " & AnonKey
    ],
    Cols = {
        "Tarifa_Normalizada_ID", "Peaje_ID", "Peaje_Nombre", "Estacion_ID", "Estacion_Nombre",
        "Categoria", "Categoria_Calculated", "Importe", "Importe_Base", "Cases",
        "Multiplicador", "Desvio", "Hora_Min", "Hora_Max", "Hora_Media",
        "Patron", "Diagnostico", "Status", "Muestra_Confiable", "Confirmado_Manual",
        "created_at", "fecha_aparicion"
    },
    Origen = Json.Document(
        Web.Contents(
            SupabaseUrl,
            [
                RelativePath = "rest/v1/" & Resource,
                Query = [select = "*", limit = "1000"],
                Headers = Headers
            ]
        )
    ),
    AsTable = Table.FromList(Origen, Splitter.SplitByNothing(), {"Row"}),
    Expanded = Table.ExpandRecordColumn(AsTable, "Row", Cols, Cols),
    Typed = Table.TransformColumnTypes(
        Expanded,
        {
            {"Tarifa_Normalizada_ID", type text},
            {"Peaje_ID", type text},
            {"Peaje_Nombre", type text},
            {"Estacion_ID", type text},
            {"Estacion_Nombre", type text},
            {"Categoria", type text},
            {"Categoria_Calculated", Int64.Type},
            {"Importe", type number},
            {"Importe_Base", type number},
            {"Cases", Int64.Type},
            {"Multiplicador", type number},
            {"Desvio", type number},
            {"Hora_Min", type number},
            {"Hora_Max", type number},
            {"Hora_Media", type number},
            {"Patron", type text},
            {"Diagnostico", type text},
            {"Status", type text},
            {"Muestra_Confiable", type logical},
            {"Confirmado_Manual", type logical},
            {"created_at", type datetimezone},
            {"fecha_aparicion", type datetimezone}
        },
        "en-US"
    )
in
    Typed
```

> Tip: guardá `SupabaseUrl` y `AnonKey` en un parámetro / consulta `Config` para no duplicar la key. En el Editor, el icono de tipo a la izquierda de cada columna debe coincidir con la tabla de arriba (ABC = texto, 123 = entero, 1.2 = decimal, calendario = fecha).

## Paginación (>1000 filas)

Es el comportamiento normal de la Data API: **no** se puede pedir `limit=3500` de una vez si `max_rows = 1000`. Hay que juntar páginas con `offset` 0, 1000, 2000, … hasta que una página venga vacía o con menos de 1000 filas (el M de arriba hace eso).

## Relaciones en el modelo

| Desde (hecho) | Hacia (dimensión) | Columna |
|---------------|-------------------|---------|
| `pwbi_pasadas` | `pwbi_estacion` | `Estacion_ID` |
| `pwbi_pasadas` | `pwbi_patentes` | `Patente_ID` |
| `pwbi_pasadas` | `pwbi_documentos` | `Documento_ID` |
| `pwbi_pasadas` | `pwbi_tarifas` | `Tarifa_Normalizada_ID` |

Cardinalidad: muchos a uno.

## Prerrequisito de permisos (anon + RLS)

Migración local: `20260811114646_peajes_pwbi_anon_api_access.sql`

- Recrea `pwbi_*` con `security_invoker = false` (evita `[]` vacío por RLS de tablas base al usar JWT **anon**).
- `GRANT SELECT` a `anon`, `authenticated`, `service_role` (sin escritura).

Aplicada en DESARROLLO: con eso Power BI refresca **solo con URL + anon key**.

### Opcional: Postgres

Solo si preferís el conector nativo (usuario/password DB del Dashboard → Connect). No usa la anon key.

## Troubleshooting

| Síntoma | Qué revisar |
|---------|-------------|
| 401 / JWT invalid | `apikey` y `Authorization: Bearer …` con la **misma** anon key |
| 404 / relation not in schema cache | Vista no expuesta; `NOTIFY pgrst, 'reload schema'` o reiniciar API; confirmar nombre `pwbi_*` |
| `[]` vacío con 200 | RLS + `security_invoker=true` (ver prerrequisito) |
| Solo 1000 filas | Paginación (`limit`/`offset`) |
| Power BI pide login Web | Credencial **Anónimo**; auth en headers |
| Columnas con mayúsculas raras | En PostgREST las columnas entrecomilladas salen con el nombre exacto (`Estacion_ID`, etc.) |
| Fechas como texto / no suma importes / tipo `Any` | Falta `Table.TransformColumnTypes` (ver [Tipos de columnas](#tipos-de-columnas-obligatorio)). Reemplazá la consulta M; no alcanza con “Detectar tipo de datos”. |

## Seguridad

- La **anon key** es pública por diseño (va en el frontend). Quien la tenga puede llamar la Data API según grants/RLS.
- Al habilitar `SELECT` anon sobre `pwbi_*` sin invoker, esas vistas quedan legibles por cualquiera con la key: es un dataset **de solo lectura** pensado para BI.
- **Nunca** pongas `service_role` en Power BI, parámetros del informe publicados ni git.
- Si rotás la anon key en el Dashboard, actualizá parámetros del `.pbix` y la app Angular / `.env`.

## Referencias

- Vistas: [docs/backend/peajes/pwbi-views.md](../backend/peajes/pwbi-views.md)
- Entornos: [`.agents/skills/backend-supabase-write/entornos.md`](../../.agents/skills/backend-supabase-write/entornos.md)
- Supabase REST: [API](https://supabase.com/docs/guides/api)
- PostgREST: [Tables and Views](https://docs.postgrest.org/en/stable/references/api/tables_views.html)

---

> Última actualización: 2026-09-02 · Conexión canónica: **API URL + anon key** (sin Postgres) · M con tipos explícitos en todas las `pwbi_*`
