# OpenProject API — Adjuntos

Usar solo para archivos de un work package. Autocontenido: no hace falta
cargar `apidocs_main.md` ni sprints si el `work_package_id` ya se conoce.

```
$BASE_URL = "https://jira.tpteibarra.ar"
$AUTH = ""
```

Headers: `-H "Accept: application/hal+json"` y `-H "Authorization: $AUTH"`.
Upload: multipart; no enviar `Content-Type: application/json`. `$AUTH` vacío
en templates. No inventar tokens.

## Listar adjuntos

`GET /api/v3/work_packages/{id}/attachments`

```
curl.exe -s `
  -X GET "$BASE_URL/api/v3/work_packages/$WORK_PACKAGE_ID/attachments" `
  -H "Accept: application/hal+json" `
  -H "Authorization: $AUTH"
```

Solo si hay que comprobar duplicados o listar. Para subir, no hace falta.

## Subir archivo

`POST /api/v3/work_packages/{id}/attachments`

`multipart/form-data` con dos partes: `metadata` (JSON) y `file` (binario).
No convertir el archivo a Base64. `metadata.fileName` es el nombre a guardar.

```
curl.exe -s `
  -X POST "$BASE_URL/api/v3/work_packages/$WORK_PACKAGE_ID/attachments" `
  -H "Accept: application/hal+json" `
  -H "Authorization: $AUTH" `
  -F "metadata={""fileName"":""$FILE_NAME""};type=application/json" `
  -F "file=@$FILE_PATH"
```

Validaciones: existe `$FILE_PATH`; `$FILE_NAME` definido; `$WORK_PACKAGE_ID`
conocido. No GET de attachments previo salvo duplicados.

## Reglas

1. Subir: POST directo. No GET attachments salvo comprobar duplicados.
2. Multipart: `metadata` + `file`. Nunca Base64.
3. Reutilizar `work_package_id` ya conocido.

## Endpoints

| Acción | Método | Endpoint |
|--------|--------|----------|
| Listar archivos | GET | `/api/v3/work_packages/{id}/attachments` |
| Subir archivo | POST | `/api/v3/work_packages/{id}/attachments` |
