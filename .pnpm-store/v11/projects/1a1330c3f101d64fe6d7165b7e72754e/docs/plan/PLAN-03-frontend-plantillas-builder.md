# PLAN 03 — Frontend Plantillas y Motor

## Objetivo

Implementar el motor Builder + Strategy, el configurador de plantillas y algoritmos combinados, sin modificar el wizard ni los catálogos.

## Dependencias y ownership

- Requiere `F00-3` en `passing`; cada persistencia depende de la F01 indicada en el feature list.
- Atiende `F03-1` a `F03-8`.
- Su scope exclusivo es `src/app/components/peajes/plantillas/**`.

## Plan de ejecución

1. Leer la skill `peajes-plantillas-builder` cuando esté disponible y el PRD §4 pasos 3–4, §§7.2–7.4, §§14.2–15 y §21.
2. Definir el registro de estrategias y el Builder de pipeline dentro de la carpeta de plantillas. Soportar los códigos y el orden determinista del caso de ejemplo: fecha/hora, patente, pase, estación e importe neto.
3. Implementar UI de builder, edición/sobrescritura, aplicación y compatibilidad de plantillas, builder/expansión de algoritmos combinados, validaciones de publicación y alcance por empresa.
4. Usar sólo interfaces de 00. Hasta que F01 esté disponible, usar adaptadores/mocks tipados y declarar en handoff la capacidad de backend pendiente.
5. Probar el motor de forma aislada con el ejemplo §21; no duplicar lógica del wizard ni crear componentes fuera de `plantillas/**`.
6. Completar evidencia F03, handoff y commit una vez verificadas sus features.

## Criterio de salida

El motor reproduce el resultado normalizado del caso de ejemplo, valida la definición antes de publicar y sus persistencias respetan las RPC de backend sin tener acoplamiento a la UI del wizard.

## Prompt para Cursor

```text
Actuá como el agente 03 (Frontend Plantillas y Motor). Esperá F00-3 `passing`; leé `AGENTS.md`, `feature_list.json`, `docs/plan/peaje-prd-es.md` (pasos 3–4, §§7.2–7.4, 14.2–15 y §21), el ejemplo MVP, el handoff y la skill `.agents/skills/peajes-plantillas-builder` si está instalada. Si falta, registrá BLOCKED y no inventes instrucciones.

Implementá exclusivamente F03-1…F03-8 bajo `src/app/components/peajes/plantillas/**`. No edites wizard, catálogos, modelos/contratos, backend, permisos ni rutas compartidas. Construí Builder + Strategy con registry seguro, transformaciones ordenadas, preview, configuración/edición/aplicación de plantillas, algoritmo combinado y validaciones previas a publicar. El caso §21 debe validar FECHA_HORA, PATENTE_ID, PASE_ID e IMPORTE_NETO. Respetá alcance por empresa, sobrescritura transaccional y la separación total de Checklists.

Consumí sólo contratos de 00. Hasta tener F01 correspondiente `passing`, usá mock/adaptador tipado e informá al handoff el contrato requerido. Ejecutá los tests F03 y build aplicable; actualizá sólo tus features con evidencia. Hacé commit descriptivo sólo si pasan las verificaciones y reportá PASS/FAIL/BLOCKED.
```
