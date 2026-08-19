---
name: epic-task-generation
description: >-
  Desglosa una épica en tasks técnicas (planteo en un .md nuevo +
  script upload_tasks.ps1 tras aprobación) y arma curls de OpenProject
  para work packages (crear/actualizar/buscar, comentarios, watchers,
  sprints, adjuntos). Usar cuando el usuario pida generar/desglosar
  tasks desde una épica, subir work packages, comentar, agregar
  watchers, asignar a sprint o adjuntar archivos. No usar para
  implementar la épica en código.
---

# Generación de tasks y acciones OpenProject

Skill distinta al resto: no implementa código de producto. El agente
**nunca ejecuta** scripts ni curls; deja archivos o comandos para el
desarrollador.

Hay dos modos. No mezclarlos:

1. **Desglose de épica** — flujo en dos etapas (abajo).
2. **Acción específica** — un work package ya existe (comentar, watcher,
   sprint, adjunto, buscar/actualizar). No pasar por las dos etapas.

## Qué leer (carga selectiva)

No cargar todos los documentos en cada pedido. Leer **solo** lo de la
acción. No reexplicar el contenido de esos archivos acá.

| Acción | Leer |
|--------|------|
| Desglose de épica — etapa 1 (planteo) | [`definitions.md`](definitions.md). **No** leer `api/*`. |
| Desglose de épica — etapa 2 (script) | [`api/apidocs_main.md`](api/apidocs_main.md) |
| Crear / actualizar / buscar task; comentario; watcher | [`api/apidocs_main.md`](api/apidocs_main.md) |
| Buscar sprint; agregar/quitar task de sprint | [`api/apidocs_sprints.md`](api/apidocs_sprints.md). Si hace falta GET/PATCH del WP, **también** main. |
| Subir / listar archivos | [`api/apidocs_files.md`](api/apidocs_files.md) |

Ejemplos:

- “Busca la task 123 y agregala al Sprint 15” → main + sprints.
- “Subí este PDF a la task 123” → solo files.

Si una acción combina WP base + sprint o archivos, sumar docs; no cargar
el tercero de más.

---

## Modo 1 — Desglose de épica

El flujo **siempre** es secuencial; la etapa 2 no empieza hasta la
aprobación explícita del usuario.

### Cuándo usar

El usuario pide desglosar una épica en tasks técnicas (y, si aprueba el
planteo, el script de subida).

### Entrada

- título de la épica
- descripción de la épica
- **id de la épica** (work package; obligatorio para `parent` en el script)
- **proyecto** de la épica (las tasks usan el mismo proyecto)

Si falta el id o el proyecto, pedirlo en la etapa 1. No hay otra fuente.

### Flujo: dos etapas con freno

```
Etapa 1 (planteo)  →  FRENAR  →  aprobación del usuario  →  Etapa 2 (script)
```

- Completar la **etapa 1** entera, escribir el planteo en un `.md` nuevo y
  **detenerse**.
- Corregir el `.md` las veces que haga falta; seguir en etapa 1.
- Pasar a la **etapa 2** **solo** si el usuario aprueba el planteo de forma
  explícita. Sin esa aprobación, no escribir el script ni “adelantar” curl.

### Etapa 1 — Planteo

Objetivo: listado de tasks acordado con el usuario, escrito en un **`.md`
nuevo** en esta carpeta de la skill. **Prohibido** crear `upload_tasks.ps1` u
otro archivo de script en esta etapa.

#### Pasos (en orden)

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

### Etapa 2 — Script de subida

**Entrada a esta etapa:** solo con aprobación explícita del planteo (etapa 1).
Leer únicamente [`api/apidocs_main.md`](api/apidocs_main.md).

Objetivo: dejar el archivo listo para que el **desarrollador** lo ejecute en
localhost. El agente **no** lo ejecuta.

#### Pasos (en orden)

1. **Escribir** `upload_tasks.ps1` en esta carpeta de la skill — un bloque
   `curl.exe` por task aprobada. Seguir `apidocs_main.md` (no reexpandir el
   template JSON). `parent` = id de épica; `project` y demás campos del
   payload: completar según el template; `description.raw` = texto crudo de
   la descripción armada en el planteo; `AUTH` vacío.
2. **Entregar** el archivo (indicar completar `AUTH` si hace falta). Un
   bloque `$body` + `curl.exe` por cada task del planteo aprobado;
   `description.raw` = el párrafo de esa task (sin la línea de SP).
3. **No ejecutar** el script ni lanzar los curls.

Si después pide cambios al script (o al planteo ya aprobado), ajustar el
archivo y listo; seguir sin ejecutarlo. Si reabre el desglose de tasks de
fondo, volver a tratarlo como etapa 1 (actualizar el `.md` del planteo) hasta
nueva aprobación.

---

## Modo 2 — Acciones específicas

El usuario pide una operación concreta sobre un work package o sprint
existente. Leer los docs de la tabla de ruteo, armar el curl según ese
archivo y **no ejecutarlo**. No escribir `upload_tasks.ps1` salvo que el
pedido sea el script de la etapa 2.

No inventar IDs, `lockVersion` ni proyectos. Reutilizar datos ya obtenidos.
Si el usuario no dio un ID obligatorio, pedirlo; no adivinarlo.
