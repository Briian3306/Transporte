# Estructura de `docs/`

Mapa oficial para ubicar documentación. Respetar numeración existente; extender con subcarpetas antes de crear categorías nuevas.

## Vista general

```
docs/
├── INDEX.md                      # Índice maestro del repositorio (crear/mantener)
│
├── plan/                         # PRD y planes (peajes)
├── configuracion/             # Secrets, entorno, despliegue
├── components/                # Componentes (peajes + shared)
├── tablas/                    # Modelo de datos / tablas de dominio
└── backend/                      # RPCs, Edge, workflow y testing Supabase
```

> **Nota**: `06-components` y `06-tablas` comparten prefijo `06` por historial del repo. No renumerar sin autorización del usuario.

> **`docs/08-sql/`**: **no usar** en este proyecto (Peajes). Eliminada. Fuente SQL = `supabase/migrations/`; documentación = `docs/backend/`.

## 01-tests — Tests

Organizar por **dominio de negocio**, luego por **feature** si aplica.

```
01-tests/
├── INDEX.md
├── START_HERE.md                 # Punto de entrada general
├── TESTING_GUIDE.md
├── INTEGRATION_TESTS_GUIDE.md
├── QUICK_REFERENCE.md
├── pedidos/
│   ├── INDEX.md
│   ├── PEDIDO_SERVICE_TESTS.md
│   └── {feature}/
└── orden-compra/
    ├── INDEX.md
    ├── ORDEN_COMPRA_SERVICE_TESTS.md
    ├── generacion/
    │   ├── INDEX.md
    │   └── GENERACION_OC_TESTS.md
    ├── confirmacion/
    └── facturacion/
```

**Regla**: Un `.spec.ts` en `src/app/features/pedidos/` → doc bajo `01-tests/pedidos/`. Servicios en subcarpetas → reflejar la misma jerarquía.

**Correlación con código**:

| Código fuente | Documentación |
|---------------|---------------|
| `src/app/features/pedidos/**/*.spec.ts` | `docs/tests/pedidos/` |
| `src/app/features/orden-compra/**/*.spec.ts` | `docs/tests/orden-compra/` |
| `src/app/shared/**/*.spec.ts` | `docs/tests/shared/` o subcarpeta temática |

## 06-components — Componentes

Subnumeración interna para tipos de UI:

| Subcarpeta | Contenido | Ejemplo existente |
|------------|-----------|-------------------|
| `buttons/` | Botones shared | `BUTTON_SPLIT_GUIDE.md` |
| `cards/` | Cards y KPIs | `CARD_INFO_GRID_GUIDE.md` |
| `inputs/` | Inputs, selectores | (crear al documentar) |
| `modals/` | Diálogos, popups | — |
| `loaders/` | Skeleton, loading | — |
| Raíz `components/` | Patrones transversales | `DYNAMIC_DIALOG_GUIDE.md` |

**Regla**: Componente en `src/app/shared/buttons/` → `06-components/08-buttons/`. Tabla reusable documentada aquí solo si es patrón de componente; guías de **uso de tabla** van en `tablas/`.

## tablas — Tablas UI

```
tablas/
├── INDEX.md
├── EJEMPLO_SELECCION_TABLA.md
├── import-excel.md
├── table-generic/
│   └── TABLE_GENERIC_GUIDE.md
├── table-generic-ng-big-data/
│   └── TABLE_BIG_DATA_GUIDE.md
└── table-items-pedidos-card/
    └── TABLE_ITEMS_PEDIDOS_GUIDE.md
```

Priorizar enlace al README en `src/app/shared/tables/{nombre}/README.md` si existe; la guía en `docs/` amplía con contexto de negocio y ejemplos de features.

## backend — Lógica de backend (canónico para SQL/RPC)

No documentar bajo `docs/08-sql/`. Usar:

```
backend/
├── index.md
├── functions/                   # Catálogo RPC (+ edge/ stub si aplica)
├── peajes/                      # Detalle de dominio Peajes
├── api/                         # Contratos HTTP si existen Edge Functions
└── supabase/                    # Transversal: workflow CLI, testing, RLS
    ├── index.md
    ├── backend-workflow.md
    └── backend-testing.md
```

Fuente de migraciones: `supabase/migrations/`.

## modulos/ — Dominios de negocio

```
modulos/
├── INDEX.md
└── peajes.md
```

## INDEX.md — Cadena de índices

Cada nivel debe enlazar al siguiente:

```
docs/INDEX.md
  └── docs/backend/index.md
        └── docs/backend/peajes/index.md
              └── docs/backend/peajes/confirmar-carga.md
```

Al agregar un documento, **siempre** actualizar el INDEX del nivel inmediatamente superior.

## Mapeo rápido: petición del usuario → ruta

| El usuario dice… | Ruta |
|------------------|------|
| "documenta RPCs / funciones Supabase" | `docs/backend/functions/` + `docs/backend/peajes/` |
| "documenta el wizard peajes" | `docs/06-components/peajes/` |
| "documenta tablas peajes" | `docs/06-tablas/peajes/` |
| "documenta el módulo peajes" | `docs/modulos/peajes.md` |
| "documenta workflow Supabase" | `docs/backend/supabase/` |
