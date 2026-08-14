---
name: epic-task-generation
description: >-
  Desglosa una épica en tasks técnicas (planteo en un .md nuevo +
  script upload_tasks.ps1 tras aprobación). Usar cuando el usuario pida
  generar/desglosar tasks desde una épica, armar el script de subida de
  work packages, o partir una épica en trabajo técnico estimado con SP.
  No usar para implementar la épica en código.
---

# Generación de tasks desde una épica

Skill distinta al resto: no implementa código de producto. Solo **lee** el
repo (skills, módulos, modelos, servicios, docs) para decidir tasks. El flujo
**siempre** es secuencial en dos etapas; la segunda no empieza hasta la
aprobación explícita del usuario.

Referencias (leerlas; no reexplicarlas acá):

- Epic, Task y StoryPoints: [`definitions.md`](definitions.md)
- Payload POST y armado del curl: [`apidocs.md`](apidocs.md)

## Cuándo usar esta skill

Usar si el usuario pide desglosar una épica en tasks técnicas (y, si aprueba
el planteo, el script de subida). No usar para implementar la épica en código.

## Entrada

El usuario aporta en el pedido:

- título de la épica
- descripción de la épica
- **id de la épica** (work package; obligatorio para `parent` en el script)
- **proyecto** de la épica (las tasks usan el mismo proyecto)

Si falta el id o el proyecto, pedirlo en la etapa 1. No hay otra fuente.

---

## Flujo: dos etapas con freno

```
Etapa 1 (planteo)  →  FRENAR  →  aprobación del usuario  →  Etapa 2 (script)
```

- Completar la **etapa 1** entera, escribir el planteo en un `.md` nuevo y
  **detenerse**.
- Corregir el `.md` las veces que haga falta; seguir en etapa 1.
- Pasar a la **etapa 2** **solo** si el usuario aprueba el planteo de forma
  explícita. Sin esa aprobación, no escribir el script ni “adelantar” curl.
- En ningún momento el agente ejecuta el script.

---

## Etapa 1 — Planteo

Objetivo: listado de tasks acordado con el usuario, escrito en un **`.md`
nuevo** en esta carpeta de la skill. **Prohibido** crear `upload_tasks.ps1` u
otro archivo de script en esta etapa.

### Pasos (en orden)

1. **Tomar entrada** — título, descripción, id y proyecto; si falta id o proyecto, pedirlo.
2. **Relevar el repo** — módulo(s) implicados; fijarse primero en la
   documentación del módulo; si no hay, revisar el código y skills afines.
   Qué existe vs qué falta.
3. **Descomponer** — capacidades del texto de la épica → bloques técnicos
   (modelo, service, endpoint, permiso, evento, worker, etc.) → tasks.
4. **Redactar cada task** — título (verbo + objeto), descripción (qué / dónde /
   criterio de listo), story points (`definitions.md`). Textos para un
   desarrollador, no para un agente. Sin dependencias entre tasks (no links ni
   bloqueos en OpenProject; el orden es solo de presentación/lectura); sin
   assignee ni AC tipo Gherkin salvo que se pidan.
5. **Aplicar granularidad** — pocas tasks cortas; juntar golpes cortos del
   mismo tipo; separar si mezcla capas y se vuelve confusa. Choice/campo +
   migración = una sola task. Última task siempre **verificar y testear**
   (casos concretos de la épica, no “probar todo”). Orden de presentación:
   fundamentos → núcleo → exposición → acceso → efectos → verificar/testear.
6. **Checklist del planteo** — cada ítem es trabajo técnico específico; ninguna
   task es una épica; sin duplicados; la épica está cubierta; SP según
   `definitions.md`; última = verificar/testear; id y proyecto de la épica
   presentes; **ningún script escrito**.
7. **Escribir el planteo** en un `.md` nuevo en esta carpeta. No
   sobrescribir docs de la skill. Usar este template:

   ```markdown
   # Tasks: {título de la épica}

   ### Épica

   **Id:** `{id}`

   **Proyecto:** {nombre del proyecto}

   **Título:** {título}

   **Descripción:** {descripción del pedido}

   ### Tasks

   #### 1. {verbo + objeto}
   **SP: {n}** — {una línea: por qué ese puntaje}

   {Un párrafo: qué hacer, en qué archivos/módulos, criterio de listo empezando por "Listo cuando…".}
   ```

   Numeración `#### 1.`, `#### 2.`, … en el orden de presentación. Última
   task: verificar y testear, con casos concretos de esta épica. Descripción
   = un párrafo; sin listas Gherkin, sin assignee, sin links/bloqueos entre
   tasks. La línea `**SP: N** — …` es obligatoria; la justificación es
   corta (complejidad / incertidumbre / riesgo), no un segundo enunciado.
8. **FRENAR** — avisar la ruta del `.md` y pedir aprobación explícita para
   armar el script, o correcciones. Quedarse en etapa 1 hasta que el usuario
   apruebe.

Si el usuario pide cambios: actualizar el `.md` del planteo y volver al
paso 7–8. No pasar a etapa 2.

Complejidad orientativa de la épica: baja = pocas tasks; media = varias por
capas; alta = agrupar por capacidad vertical (si el listado explota, avisar).

---

## Etapa 2 — Script de subida

**Entrada a esta etapa:** solo con aprobación explícita del planteo (etapa 1).

Objetivo: dejar el archivo listo para que el **desarrollador** lo ejecute en
localhost. El agente **no** lo ejecuta.

### Pasos (en orden)

1. **Escribir** `upload_tasks.ps1` en esta carpeta de la skill — un bloque
   `curl.exe` por task aprobada. Seguir [`apidocs.md`](apidocs.md) (no
   reexpandir el template JSON). `parent` = id de épica; `project` y demás
   campos del payload: completar según el template en apidocs;
   `description.raw` = texto crudo de la descripción armada en el planteo;
   `AUTH` vacío.
2. **Entregar** el archivo (indicar completar `AUTH` si hace falta).
   Esqueleto y payload en [`apidocs.md`](apidocs.md); un bloque `$body` +
   `curl.exe` por cada task del planteo aprobado; `description.raw` = el
   párrafo de esa task (sin la línea de SP).
3. **No ejecutar** el script ni lanzar los curls.

Si después pide cambios al script (o al planteo ya aprobado), ajustar el
archivo y listo; seguir sin ejecutarlo. Si reabre el desglose de tasks de
fondo, volver a tratarlo como etapa 1 (actualizar el `.md` del planteo) hasta
nueva aprobación.
