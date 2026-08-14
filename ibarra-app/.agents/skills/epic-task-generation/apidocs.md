# Autenticacion para requests

Utiliza un header que es para autorizacion (dejar vacio)

# POST para paquetes de trabajo (tasks)

Request a referenciar: `POST /api/v3/work_packages`

## Json template for POST

```json
{
    "payload": {
        "description": {
            "raw": ""
        },
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
            "assignee": {
                "href": null
            },
            "attachments": [],
            "category": {
                "href": null
            },
            "parent": {
                "href": null
            },
            "priority": {
                "href": "/api/v3/priorities/{id}",
                "title": "Normal"
            },
            "project": {
                "href": "/api/v3/projects/{id}",
                "title": ""
            },
            "projectPhase": {
                "href": null
            },
            "projectPhaseDefinition": {
                "href": null
            },
            "responsible": {
                "href": null
            },
            "self":{
                "href": null
            },
            "sprint": {
                "href": null
            },
            "status": {
                "href": "/api/v3/statuses/{id}",
                "title": "New"
            },
            "type": {
                "href": "/api/v3/types/{id}",
                "title": "Task"
            },
            "version": {
                "href": null
            }
        },
        "_meta": {
            "validateCustomFields": true
        }
    }
}
```

- Datos a completar por task (según este template):
    - `description.raw` → texto crudo de la descripción armada en el planteo
    - storyPoints
    - subject
    - parent → `/api/v3/work_packages/{id_epica}` (id del pedido; obligatorio en el script)
    - project → completar según este template (mismo proyecto que la épica; id/título en la tabla Project abajo)
    - priority, status, type → ids/títulos de las secciones abajo; no inventarlos

### Types

| ID  | Type |
|:----|:-----|
| 1   | Task |   

### Status

| ID  | Status |
|:----|:-------|
| 1   | New    |   

### Priority

| ID  | Priority |
|:----|:---------|
| 8   | Normal   |   

### Project

| ID  | Project (title)             |
|:----|:----------------------------|
| 9   | Frontend Sistema de Gestion |   
| 10  | Backend Sistema de Gestion  |   
| 11  | Frontend Gestion de Compras |   
| 12  | Infraestructura             |   
| 15  | Soporte interno             | 
|  16 | portal-transporte-ibarra    |

## Armado del curl

Un bloque `curl.exe` por task. El body es el mismo `payload` del template de
arriba, compactado en **una sola línea** dentro de `$body` (no reescribir el
JSON expandido). Se escribe en `$BODY_FILE` y se envía con `--data-binary`.

Reglas:

- `BASE_URL`: producción `https://jira.tpteibarra.ar`
- `Authorization`: dejar vacío; credenciales solo las completa el usuario
- `parent.href`: id de épica del pedido
- `project` / `priority` / `status` / `type`: completar según template + tablas
- `description.raw`: texto crudo de la descripción armada en el planteo
- `$body`: string JSON en una línea, entre comillas simples
- `$BODY_FILE`: archivo temp único; se sobrescribe antes de cada request
- Éxito HTTP: 200 o 201; al final solo `"Subida terminada."` o `"Hubo errores."` (sin detalle)

Forma del request:

```
$BASE_URL = "https://jira.tpteibarra.ar"
$AUTH = ""
$ERRORS = 0
$BODY_FILE = Join-Path $PSScriptRoot "_body.json"

$body = '{<campos description→subject>,<"_links">,<"_meta">}'
[System.IO.File]::WriteAllText($BODY_FILE, $body)
$code = curl.exe -s --output NUL -w "%{http_code}" `
  -X POST "$BASE_URL/api/v3/work_packages" `
  -H "Content-Type: application/json" `
  -H "Accept: application/hal+json" `
  -H "Authorization: $AUTH" `
  --data-binary "@$BODY_FILE"
if ($code -ne "200" -and $code -ne "201") { $ERRORS++ }

Remove-Item $BODY_FILE -ErrorAction SilentlyContinue

if ($ERRORS -eq 0) {
  Write-Output "Subida terminada."
} else {
  Write-Output "Hubo errores."
}
```
