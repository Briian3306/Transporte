# OpenProject API — Sprints

Usar solo si la operación involucra sprints. Auth y PATCH genérico de WP
están en `apidocs_main.md`. Cargar main **además** cuando haga falta GET del
WP o un `lockVersion` que aún no se tiene.

```
$BASE_URL = "https://jira.tpteibarra.ar"
$AUTH = ""
```

Headers: `-H "Accept: application/hal+json"` y `-H "Authorization: $AUTH"`.
PATCH: también `-H "Content-Type: application/json"`. `$AUTH` vacío en templates.

## Listar sprints de un proyecto

`GET /api/v3/projects/{project_id}/sprints`

Preferir este endpoint si el proyecto ya es conocido. No listar todos los
sprints y filtrar en cliente.

```
curl.exe -s `
  -X GET "$BASE_URL/api/v3/projects/$PROJECT_ID/sprints?pageSize=100" `
  -H "Accept: application/hal+json" `
  -H "Authorization: $AUTH"
```

Elementos en `_embedded.elements`. Campos: `id`, `name`, `startDate`,
`finishDate`, `_links.self.href`, `_links.status`, `_links.definingWorkspace`.

## Listar todos los sprints

`GET /api/v3/sprints`

Solo si no se conoce el proyecto o hacen falta sprints de varios proyectos.

```
curl.exe -s `
  -X GET "$BASE_URL/api/v3/sprints?offset=1&pageSize=100" `
  -H "Accept: application/hal+json" `
  -H "Authorization: $AUTH"
```

## Obtener un sprint

`GET /api/v3/sprints/{id}`

No hacer este request si `sprint_id` (y lo demás necesario) ya salió de la
colección del proyecto.

```
curl.exe -s `
  -X GET "$BASE_URL/api/v3/sprints/$SPRINT_ID" `
  -H "Accept: application/hal+json" `
  -H "Authorization: $AUTH"
```

## Asignar / quitar task de un sprint

No existe `POST /api/v3/sprints/{id}/work_packages`. El sprint se cambia en
el work package:

`PATCH /api/v3/work_packages/{id}`

Hace falta el `lockVersion` actual. No inventarlo. Si no está, GET el WP
(ver main) y reutilizar ese valor. Si ya hay `lockVersion` reciente, PATCH
directo.

Asignar:

```json
{"lockVersion":4,"_links":{"sprint":{"href":"/api/v3/sprints/3"}}}
```

Quitar (`href` null):

```json
{"lockVersion":4,"_links":{"sprint":{"href":null}}}
```

```
$body = "{`"lockVersion`":$LOCK_VERSION,`"_links`":{`"sprint`":{`"href`":`"/api/v3/sprints/$SPRINT_ID`"}}}"
[System.IO.File]::WriteAllText($BODY_FILE, $body)
$code = curl.exe -s --output NUL -w "%{http_code}" `
  -X PATCH "$BASE_URL/api/v3/work_packages/$WORK_PACKAGE_ID" `
  -H "Content-Type: application/json" `
  -H "Accept: application/hal+json" `
  -H "Authorization: $AUTH" `
  --data-binary "@$BODY_FILE"
```

Éxito: 200.

## Reglas

1. Proyecto conocido → `GET /projects/{id}/sprints`, no `GET /sprints`.
2. Reutilizar `sprint_id` de la colección; no `GET /sprints/{id}` de más.
3. Asignar: GET WP (si falta `lockVersion`) → PATCH `_links.sprint`.
4. Paginación: `pageSize=100`; si `total > count`, seguir.

## Endpoints

| Acción | Método | Endpoint |
|--------|--------|----------|
| Sprints de proyecto | GET | `/api/v3/projects/{project_id}/sprints` |
| Todos los sprints | GET | `/api/v3/sprints` |
| Obtener sprint | GET | `/api/v3/sprints/{id}` |
| Asignar / quitar de sprint | PATCH | `/api/v3/work_packages/{id}` |
