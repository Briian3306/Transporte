# Estructura de `docs/`

Mapa oficial para ubicar documentación. Respetar numeración existente; extender con subcarpetas antes de crear categorías nuevas.

## Vista general

```
docs/
├── INDEX.md                      # Índice maestro del repositorio (crear/mantener)
├── PRD-OrdenCompraIbarra.md      # Requisitos de producto
│
├── 01-tests/                     # Tests unitarios e integración
├── 02-git/                       # Flujo Git, ramas, commits
├── 03-versionamiento/            # Versiones, releases, changelog
├── 04-lazy-loading/              # Carga diferida Angular
├── 05-configuracion/             # Secrets, entorno, despliegue
├── 06-components/                # Componentes shared (buttons, cards, inputs…)
├── 06-tablas/                    # Documentación de tablas UI
├── 07-testing-adicional/         # Tests E2E, datos de prueba, escenarios extra
└── 08-sql/                       # Scripts SQL y esquema de BD. 
└── backend                       # Documentación de supabase / backend
```

> **Nota**: `06-components` y `06-tablas` comparten prefijo `06` por historial del repo. No renumerar sin autorización del usuario.

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
| `src/app/features/pedidos/**/*.spec.ts` | `docs/01-tests/pedidos/` |
| `src/app/features/orden-compra/**/*.spec.ts` | `docs/01-tests/orden-compra/` |
| `src/app/shared/**/*.spec.ts` | `docs/01-tests/shared/` o subcarpeta temática |

## 06-components — Componentes

Subnumeración interna para tipos de UI:

| Subcarpeta | Contenido | Ejemplo existente |
|------------|-----------|-------------------|
| `08-buttons/` | Botones shared | `BUTTON_SPLIT_GUIDE.md` |
| `09-cards/` | Cards y KPIs | `CARD_INFO_GRID_GUIDE.md` |
| `10-inputs/` | Inputs, selectores | (crear al documentar) |
| `11-modals/` | Diálogos, popups | — |
| `12-loaders/` | Skeleton, loading | — |
| Raíz `06-components/` | Patrones transversales | `DYNAMIC_DIALOG_GUIDE.md` |

**Regla**: Componente en `src/app/shared/buttons/` → `06-components/08-buttons/`. Tabla reusable documentada aquí solo si es patrón de componente; guías de **uso de tabla** van en `06-tablas/`.

## 06-tablas — Tablas UI

```
06-tablas/
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

## 08-sql — Base de datos

```
08-sql/
├── INDEX.md
├── 152_table_condiciones_pago.sql
├── 152_table_condiciones_pago.md    # Companion opcional
└── migraciones/
    └── 2025-06-09_add_campo_x.sql
```

Convención de nombre SQL: `{numero}_{accion}_{objeto}.sql` (número secuencial o timestamp).

## Documentos en raíz de `docs/`

Solo para temas **transversales** (varias features):

- `IMPORT_EXCEL_WORKFLOW.md`
- `PRD-OrdenCompraIbarra.md`

Si un workflow es de una sola feature, moverlo a la subcarpeta correspondiente.

## backend — Logica de backend 
Logica relacionada con backend tablas, logica de negocio, funciones y testing. 
```
backend/
├── api/                         # Documentación relacionada con API
├── functions/                   # Catálogo RPC y Edge Functions
├── {modulo}/                    # pedidos, ordenes-compra, productos, etc.
├── kanban/                      # Contrato card / adapters Kanban (cross-domain)
└── supabase/                    # Transversal Supabase
    ├── index.md                 # RLS, auth, enlaces
    ├── backend-workflow.md      # Flujo CLI (migraciones, deploy)
    ├── backend-testing.md       # pgTAP, RLS, tests
    └── auth-roles-globales.md
```

## modulos/ — Dominios de negocio

```
modulos/
├── INDEX.md
├── pedidos/
├── ordenes-compra/
├── kanban/                      # Board Kanban (UI, filtros, formato; Future Features)
├── facturas/
├── proveedores/
├── productos/
└── presupuesto/
```
## INDEX.md — Cadena de índices

Cada nivel debe enlazar al siguiente:

```
docs/INDEX.md
  └── 01-tests/INDEX.md
        └── 01-tests/orden-compra/INDEX.md
              └── 01-tests/orden-compra/generacion/GENERACION_OC_TESTS.md
```

Al agregar un documento, **siempre** actualizar el INDEX del nivel inmediatamente superior.

## Mapeo rápido: petición del usuario → ruta

| El usuario dice… | Ruta |
|------------------|------|
| "documenta los tests de pedidos" | `docs/01-tests/pedidos/` |
| "documenta generación de OC" | `docs/01-tests/orden-compra/generacion/` o `docs/06-components/` según si es test o UI |
| "documenta table-generic" | `docs/06-tablas/table-generic/` |
| "documenta el botón split" | `docs/06-components/08-buttons/` |
| "documenta la tabla SQL condiciones_pago" | `docs/08-sql/` |
| "documenta input-modal-selector" | `docs/06-components/10-inputs/` |
| "documenta el kanban" | `docs/modulos/kanban/` |
| "documenta contrato card kanban" | `docs/backend/kanban/` |
