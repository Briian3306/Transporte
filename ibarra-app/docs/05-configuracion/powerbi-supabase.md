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
7. Repetí para `pwbi_patentes`, `pwbi_documentos` y `pwbi_pasadas`.
8. **Cerrar y aplicar**.

Autenticación del origen Web: si Power BI pide credenciales del origen, usá **Anónimo** (la auth va en los headers `apikey` / `Authorization`, no en el diálogo de usuario/contraseña).

## Power Query M (recomendado)

PostgREST / Supabase limita **1000 filas por request** (`max_rows`). Para `pwbi_pasadas` (~3500+) usá **paginación**. Para catálogos chicos (`pwbi_estacion`, `pwbi_patentes`) alcanza una sola página.

### `pwbi_pasadas` (paginado — pegar completo)

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
    Expanded = Table.ExpandRecordColumn(AsTable, "Row", Record.FieldNames(AsTable{0}[Row]))
in
    Expanded
```

### Catálogos (`pwbi_estacion` / `pwbi_patentes` / `pwbi_documentos`)

Misma idea, sin bucle (o con `Resource` distinto y `limit = "1000"`). Cambiá solo `Resource` a `pwbi_estacion`, `pwbi_patentes` o `pwbi_documentos`.

```powerquery
let
    SupabaseUrl = "https://SUPABASE_URL.supabase.co",
    AnonKey = "SUPABASE_KEY",
    Resource = "pwbi_estacion",
    Headers = [
        apikey = AnonKey,
        Authorization = "Bearer " & AnonKey
    ],
    Origen = Json.Document(
        Web.Contents(
            SupabaseUrl,
            [
                RelativePath = "rest/v1/" & Resource,
                Query = [
                    select = "*",
                    limit = "1000"
                ],
                Headers = Headers
            ]
        )
    ),
    AsTable = Table.FromList(Origen, Splitter.SplitByNothing(), {"Row"}),
    Expanded = Table.ExpandRecordColumn(AsTable, "Row", Record.FieldNames(AsTable{0}[Row]))
in
    Expanded
```

> Tip: guardá `SupabaseUrl` y `AnonKey` en un parámetro / consulta `Config` para no duplicar la key.

## Paginación (>1000 filas)

Es el comportamiento normal de la Data API: **no** se puede pedir `limit=3500` de una vez si `max_rows = 1000`. Hay que juntar páginas con `offset` 0, 1000, 2000, … hasta que una página venga vacía o con menos de 1000 filas (el M de arriba hace eso).

## Relaciones en el modelo

| Desde (hecho) | Hacia (dimensión) | Columna |
|---------------|-------------------|---------|
| `pwbi_pasadas` | `pwbi_estacion` | `Estacion_ID` |
| `pwbi_pasadas` | `pwbi_patentes` | `Patente_ID` |
| `pwbi_pasadas` | `pwbi_documentos` | `Documento_ID` |

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

> Última actualización: agosto 2026 · Conexión canónica: **API URL + anon key** (sin Postgres)
