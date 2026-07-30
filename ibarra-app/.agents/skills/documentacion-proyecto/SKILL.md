---
name: documentacion-proyecto
description: >-
  Metodologia experta para crear, refactorizar y mantener documentacion tecnica
  en Transporte Ibarra / módulo Peajes (ibarra-app). Usar cuando el usuario pida
  documentar, reorganizar, dividir, normalizar o actualizar docs sin duplicados,
  y cuando haya que vincular modulos, componentes, tablas, tests, SQL o
  arquitectura. Coordinacion canónica: AGENTS.md, feature_list.json,
  docs/claude-progress.md, docs/session-handoff.md.
---

# Documentación del proyecto

Usar esta skill para transformar documentación desordenada en un sistema
consistente, trazable y fácil de actualizar en **ibarra-app** (Peajes y módulos host).

## Objetivo

1. Organizar la documentación por dominio y por tipo de artefacto.
2. Evitar duplicación: una idea, una ubicación canónica.
3. Separar módulos, componentes, arquitectura y soporte transversal.
4. Actualizar solo lo afectado por el cambio real.
5. Mantener enlaces entre documentos relacionados.

## Regla base

Antes de escribir:

1. Identificar el artefacto fuente real: `.ts`, `.spec.ts`, `.sql`, `README.md`, flujo o feature.
2. Buscar si ya existe documentación equivalente.
3. Elegir un único documento canónico.
4. Actualizar índices padre y referencias cruzadas.
5. Si el cambio impacta varios dominios, documentar el impacto en cada uno, no repetir la misma explicación completa.

## Estructura recomendada

Usar una organización por capas:

```text
docs/
├── plan/                 # PRD y planes de agentes (peajes)
├── session-handoff.md
├── claude-progress.md
├── modulos/
│   └── peajes.md
├── 06-components/peajes/
├── 06-tablas/peajes/
├── 08-sql/{task}/
└── backend/supabase/     # si existe workflow local
```

Para Peajes, el agente 04 documenta tras features `passing`. No inventar comportamiento no implementado.

## Criterio de clasificación

### `modulos/`

Usar para documentar features o dominios de negocio. Cada módulo debe explicar:

- propósito
- flujo principal
- datos que consume y produce
- dependencias con otros módulos
- documentos hijos por subfunción si hace falta

### `componentes/`

Usar para piezas reutilizables. Dividir por tipo:

- `tablas/`: tablas genéricas, big data, lazy loading, selección
- `formularios/`: inputs, selectores, validadores, formularios complejos
- `modales/`: dialogs, popups, confirmaciones
- `servicios/`: servicios shared y utilitarios
- `shared/`: patrones transversales que no son de UI pura

### `arquitectura/`

Usar para documentos transversales:

- flujo general del sistema
- dependencias entre módulos
- diagramas y decisiones de arquitectura

## Metodología de refactor

Cuando la documentación está dispersa:

1. Inventariar archivos existentes.
2. Agrupar por intención, no por nombre histórico.
3. Detectar duplicados y marcar el documento canónico.
4. Mover o reescribir contenido para que cada archivo tenga una sola responsabilidad.
5. Crear índices de carpeta si faltan.
6. Insertar enlaces hacia documentos relacionados.
7. Dejar un documento de arquitectura si la información está repartida en varios módulos.

## Regla de actualización mínima

Actualizar solo lo necesario según el tipo de cambio:

| Cambio | Actualizar |
|---|---|
| Cambia un componente shared | Su guía, el índice de su carpeta y los módulos que lo usan |
| Cambia un módulo de negocio | Su documento, el índice del módulo y la arquitectura si afecta flujos |
| Cambia una tabla o servicio reusable | Su guía y las referencias de los módulos consumidores |
| Cambia un SQL | Su documento SQL y el documento del módulo afectado |

No reescribir documentación vecina si el comportamiento no cambió.

## Plantilla mínima por documento

Todo documento nuevo o refactorizado debe incluir:

1. Resumen breve.
2. Índice interno.
3. Funcionalidad.
4. Dependencias o relaciones.
5. Ejemplos o snippets si aportan claridad.
6. Referencias a documentos relacionados.

## Índices

Cada carpeta relevante debe tener `INDEX.md` o un índice equivalente.

Regla:

- actualizar el índice local
- actualizar el índice padre
- actualizar enlaces cruzados si el documento se mueve

## Convenciones

- Escribir en español técnico y claro.
- Usar nombres de carpetas en `kebab-case`.
- Mantener un único documento por tema.
- Si un tema crece mucho, dividirlo por subtema antes de crear duplicados.
- Preferir documentos cortos y específicos sobre documentos enormes y ambiguos.

## Referencias

- Estructura y taxonomía: [estructura.md](estructura.md)
- Plantillas base: [plantillas.md](plantillas.md)
- Documentación existente del proyecto: `docs/`

