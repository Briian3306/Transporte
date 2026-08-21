# OpenProject API — Work Packages

Documento por defecto. Operaciones base sobre work packages: crear, listar,
obtener, actualizar, comentarios y watchers. No cubre sprints ni adjuntos.

## Autenticación

Token en `.env` de esta skill (junto a `SKILL.md`), no en este archivo ni en
chat:

```
OPENPROJECT_AUTH=opapi-...
```

Solo el valor del API token. No incluir `Basic`, `apikey:` ni comillas.

Cargar y armar el header (Basic usuario `apikey` + token). No `Write-Output`
del token ni pasarlo como literal en la línea de comando:

```
$BASE_URL = "https://jira.tpteibarra.ar"
$envPath = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envPath)) { $envPath = Join-Path $PSScriptRoot "..\.env" }
$line = Get-Content $envPath | Where-Object { $_ -match '^OPENPROJECT_AUTH=' } | Select-Object -First 1
$token = $line.Substring('OPENPROJECT_AUTH='.Length).Trim()
$AUTH = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("apikey:$token"))
```

Si el script no está en `api/`, usar la carpeta de la skill como raíz del
`.env`. Headers: `-H "Accept: application/hal+json"` y
`-H "Authorization: $AUTH"`. JSON: también `-H "Content-Type: application/json"`.

No inventar tokens. Si falta `.env` o `OPENPROJECT_AUTH`, no adivinar: pedir
al usuario que lo cree (ver `.env.example`).

## Crear task

`POST /api/v3/work_packages`

Template (compactar a una línea en `$body`; no reescribir expandido en el script):

```json
{
    "payload": {
        "description": { "raw": "" },
        "dueDate": null,
        "duration": null,
        "estimatedTime": null,
        "ignoreNonWorkingDays": false,
        "percentageDone": null,
        "scheduleManually": true,
        "startDate": null,
        "storyPoints": null,
        "subject": "",
        "_links": {
            "assignee": { "href": null },
            "attachments": [],
            "category": { "href": null },
            "parent": { "href": null },
            "priority": { "href": "/api/v3/priorities/{id}", "title": "Normal" },
            "project": { "href": "/api/v3/projects/{id}", "title": "" },
            "projectPhase": { "href": null },
            "projectPhaseDefinition": { "href": null },
            "responsible": { "href": null },
            "self": { "href": null },
            "sprint": { "href": null },
            "status": { "href": "/api/v3/statuses/{id}", "title": "New" },
            "type": { "href": "/api/v3/types/{id}", "title": "Task" },
            "version": { "href": null }
        },
        "_meta": { "validateCustomFields": true }
    }
}
```

Completar por task: `description.raw`, `storyPoints`, `subject`,
`parent.href` (`/api/v3/work_packages/{id_epica}`), `project` (mismo de la
épica). No inventar project/type/status/priority.

| Recurso | ID | Título |
|---------|----|--------|
| Type | 1 | Task |
| Status | 1 | New |
| Priority | 8 | Normal |

| ID | Project |
|----|---------|
| 9 | Frontend Sistema de Gestion |
| 10 | Backend Sistema de Gestion |
| 11 | Frontend Gestion de Compras |
| 12 | Infraestructura |
| 15 | Soporte interno |
| 16 | portal-transporte-ibarra |

### Armado del curl (script de subida)

Un `curl.exe` por task. `$body` en una línea, a `$BODY_FILE`, envío con
`--data-binary`. Sobrescribir `$BODY_FILE` antes de cada request. Éxito:
200 o 201. Al final solo `"Subida terminada."` o `"Hubo errores."`.

```
# Cargar $BASE_URL y $AUTH desde .env (bloque Autenticación)
$ERRORS = 0
$BODY_FILE = Join-Path $PSScriptRoot "_body.json"

$body = '{"payload":{"description":{"raw":"Descripcion de la task"},"dueDate":null,"duration":null,"estimatedTime":null,"ignoreNonWorkingDays":false,"percentageDone":null,"scheduleManually":true,"startDate":null,"storyPoints":3,"subject":"Titulo de la task","_links":{"assignee":{"href":null},"attachments":[],"category":{"href":null},"parent":{"href":"/api/v3/work_packages/123"},"priority":{"href":"/api/v3/priorities/8","title":"Normal"},"project":{"href":"/api/v3/projects/9","title":"Frontend Sistema de Gestion"},"projectPhase":{"href":null},"projectPhaseDefinition":{"href":null},"responsible":{"href":null},"self":{"href":null},"sprint":{"href":null},"status":{"href":"/api/v3/statuses/1","title":"New"},"type":{"href":"/api/v3/types/1","title":"Task"},"version":{"href":null}},"_meta":{"validateCustomFields":true}}}'

[System.IO.File]::WriteAllText($BODY_FILE, $body)
$code = curl.exe -s --output NUL -w "%{http_code}" `
  -X POST "$BASE_URL/api/v3/work_packages" `
  -H "Content-Type: application/json" `
  -H "Accept: application/hal+json" `
  -H "Authorization: $AUTH" `
  --data-binary "@$BODY_FILE"
if ($code -ne "200" -and $code -ne "201") { $ERRORS++ }
Remove-Item $BODY_FILE -ErrorAction SilentlyContinue

if ($ERRORS -eq 0) { Write-Output "Subida terminada." } else { Write-Output "Hubo errores." }
```

## Consultas

Un GET, no un GET por task. `$AUTH` siempre desde `.env` (bloque Autenticación).
URL-encode `filters` y `select` (`[uri]::EscapeDataString`). `pageSize=100`.
Si `total > count`, paginar con `offset`. No asumir una sola página.

### Mis tasks (asignado = yo)

`GET /api/v3/work_packages` — no listar por workspace ni filtrar en cliente.

Filtro: `[{"assignee":{"operator":"=","values":["me"]}}]`. No hace falta
`GET /api/v3/users/me` para este filtro. `me` es el usuario del token.

`select` de colección (no incluir `lockVersion`; la API responde 400):

`total,count,elements/id,elements/subject,elements/status,elements/project,elements/type,elements/dueDate`

```
$filters = [uri]::EscapeDataString('[{"assignee":{"operator":"=","values":["me"]}}]')
$select = [uri]::EscapeDataString('total,count,elements/id,elements/subject,elements/status,elements/project,elements/type,elements/dueDate')
curl.exe -s `
  -X GET "$BASE_URL/api/v3/work_packages?filters=$filters&pageSize=100&offset=1&select=$select" `
  -H "Accept: application/hal+json" `
  -H "Authorization: $AUTH"
```

Respuesta: `total` / `count`; cada elemento trae `id`, `subject`, `dueDate` y
`_links.status|project|type` con `title`. Solo abiertas: agregar al array de
filtros `{"status":{"operator":"o","values":[]}}` (open) si se pide.

### Listar por proyecto

Código nuevo; no usar `/api/v3/projects/{id}/work_packages`:

`GET /api/v3/workspaces/{project_id}/work_packages`

```
$select = [uri]::EscapeDataString('total,count,elements/id,elements/subject,elements/status,elements/project,elements/type')
curl.exe -s `
  -X GET "$BASE_URL/api/v3/workspaces/$PROJECT_ID/work_packages?filters=[]&pageSize=100&offset=1&select=$select" `
  -H "Accept: application/hal+json" `
  -H "Authorization: $AUTH"
```

Sin filtros: `filters=[]`. `lockVersion` para PATCH: GET de un WP, no del listado.

Obtener uno: `GET /api/v3/work_packages/{id}`

```
curl.exe -s `
  -X GET "$BASE_URL/api/v3/work_packages/$WORK_PACKAGE_ID" `
  -H "Accept: application/hal+json" `
  -H "Authorization: $AUTH"
```

Usar GET uno cuando hace falta el detalle o un `lockVersion` actual para PATCH.

## Actualizar

`PATCH /api/v3/work_packages/{id}`

Enviar el `lockVersion` actual. No inventarlo. Flujo: GET → `lockVersion` →
PATCH. Si ya hay un `lockVersion` reciente, reutilizarlo (sin otro GET).

```
$body = '{"lockVersion":4,"subject":"Nuevo titulo"}'
[System.IO.File]::WriteAllText($BODY_FILE, $body)
curl.exe -s --output NUL -w "%{http_code}" `
  -X PATCH "$BASE_URL/api/v3/work_packages/$WORK_PACKAGE_ID" `
  -H "Content-Type: application/json" `
  -H "Accept: application/hal+json" `
  -H "Authorization: $AUTH" `
  --data-binary "@$BODY_FILE"
```

Éxito: 200.

## Comentarios (activities)

Agregar: `POST /api/v3/work_packages/{id}/activities`

Body: `{"comment":{"raw":"Texto del comentario"}}`. No GET previo salvo que
haya que leer el historial. `?notify=false` solo si se pide evitar notificación.

```
$body = '{"comment":{"raw":"Texto del comentario"}}'
curl.exe -s --output NUL -w "%{http_code}" `
  -X POST "$BASE_URL/api/v3/work_packages/$WORK_PACKAGE_ID/activities" `
  -H "Content-Type: application/json" `
  -H "Accept: application/hal+json" `
  -H "Authorization: $AUTH" `
  --data-binary "@$BODY_FILE"
```

Listar: `GET /api/v3/work_packages/{id}/activities` — elementos en
`_embedded.elements`; texto en `comment.raw`.

## Watchers

Listar: `GET /api/v3/work_packages/{id}/watchers` — `_embedded.elements`
(`id`, `name`, `login`, `mail`, `_links.self.href`).

Disponibles: `GET /api/v3/work_packages/{id}/available_watchers`. No usarlo
si el `user_id` ya se conoce.

Agregar: `POST /api/v3/work_packages/{id}/watchers`

Body: `{"user":{"href":"/api/v3/users/{user_id}"}}`. Éxito: 200 (ya era
watcher) o 201 (agregado). No hace falta GET previo.

Eliminar: `DELETE /api/v3/work_packages/{id}/watchers/{user_id}` — éxito 204.

```
curl.exe -s --output NUL -w "%{http_code}" `
  -X DELETE "$BASE_URL/api/v3/work_packages/$WORK_PACKAGE_ID/watchers/$USER_ID" `
  -H "Accept: application/hal+json" `
  -H "Authorization: $AUTH"
```

## Reglas de optimización

1. Listar por proyecto (`/workspaces/{id}/work_packages`), no un GET por task.
2. Usar `select` si solo hacen falta id, subject y lockVersion.
3. Reutilizar `project_id`, `work_package_id`, `user_id` ya conocidos.
4. Reutilizar `lockVersion` de un GET reciente; no repetir GET.
5. Watcher: POST directo si hay `user_id`; no GET available_watchers.
6. Comentario: POST directo; no GET activities salvo historial.
7. No validar con un request extra si el propio endpoint responde 200/201/204.
8. Colecciones: `pageSize=100`; si `total > count`, paginar.

## Endpoints

| Acción | Método | Endpoint |
|--------|--------|----------|
| Crear task | POST | `/api/v3/work_packages` |
| Listar WP asignados a mí | GET | `/api/v3/work_packages` (`filters` assignee=`me`) |
| Listar WP de proyecto | GET | `/api/v3/workspaces/{project_id}/work_packages` |
| Obtener WP | GET | `/api/v3/work_packages/{id}` |
| Actualizar WP | PATCH | `/api/v3/work_packages/{id}` |
| Listar comentarios | GET | `/api/v3/work_packages/{id}/activities` |
| Agregar comentario | POST | `/api/v3/work_packages/{id}/activities` |
| Listar watchers | GET | `/api/v3/work_packages/{id}/watchers` |
| Watchers disponibles | GET | `/api/v3/work_packages/{id}/available_watchers` |
| Agregar watcher | POST | `/api/v3/work_packages/{id}/watchers` |
| Eliminar watcher | DELETE | `/api/v3/work_packages/{id}/watchers/{user_id}` |
