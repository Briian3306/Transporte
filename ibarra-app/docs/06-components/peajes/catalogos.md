# Guía — Catálogos Peajes (UI)

## Resumen

Pantallas CRUD de catálogos del dominio Peajes: **empresas**, peajes, estaciones, patentes y pases. Usan el token `PEAJES_CATALOGO_SERVICE` → `PeajesCatalogoSupabaseService`.

## Índice

- [Resumen](#resumen)
- [Estructura](#estructura)
- [Rutas](#rutas)
- [Empresas](#empresas)
- [Comportamiento](#comportamiento)
- [Providers](#providers)
- [Verificación](#verificación)
- [Referencias](#referencias)

---

## Estructura

```text
src/app/components/peajes/catalogos/
  peajes-catalogos-home.component.*   # cards (CATALOGOS_CARDS)
  empresas/catalogo-empresas.component.*
  peajes/catalogo-peajes.component.*  # select empresa + crear
  estaciones/catalogo-estaciones.component.*
  patentes/catalogo-patentes.component.*
  pases/catalogo-pases.component.*
  catalogos.routes.ts
  catalogos.providers.ts
```

---

## Rutas

Fragmento `PEAJES_CATALOGOS_ROUTES` (fusionado en `peajes.routes.ts`):

| Path | Componente |
|------|------------|
| `/peajes/catalogos` | Home catálogos |
| `/peajes/catalogos/empresas` | Catálogo empresas |
| `/peajes/catalogos/peajes` | Catálogo peajes |
| `/peajes/catalogos/estaciones` | Catálogo estaciones |
| `/peajes/catalogos/patentes` | Catálogo patentes |
| `/peajes/catalogos/pases` | Catálogo pases |

---

## Empresas

- Card **Empresas** en el home (`CATALOGOS_CARDS`).
- Alta por nombre/descripción vía `crearEmpresa` / `listarEmpresas`.
- En **Catálogo de peajes**, el campo libre `empresa_id` se reemplazó por un **dropdown** + diálogo **+ Crear empresa** (mismo patrón que Paso 1 del wizard).
- La lista de peajes muestra el nombre de empresa.

---

## Comportamiento

- Listado y alta/edición vía interfaz `PeajesCatalogoService`.
- Estaciones ligadas a `peaje_id`; `codigos_proveedor` para sugerencias del wizard.
- Patentes: categoría según constraint actual (incluye TRANSPORTE / REMIS / OBRA / AUTO tras F06).
- Pases: asociados a una patente.

---

## Providers

```ts
{ provide: PEAJES_CATALOGO_SERVICE, useExisting: PeajesCatalogoSupabaseService }
```

Cableado en `PEAJES_CATALOGO_PROVIDERS` / `PEAJES_SUPABASE_PROVIDERS`.

---

## Verificación

Incluida en la suite wizard+catalogos (ver [wizard.md](./wizard.md)).

---

## Referencias

- Tablas: [docs/06-tablas/peajes/catalogos.md](../../06-tablas/peajes/catalogos.md)
- Servicio: `services/peajes-catalogo.service.ts`
- SQL empresas / F06: [docs/08-sql/peajes/F06-catalogos-plantillas/README.md](../../08-sql/peajes/F06-catalogos-plantillas/README.md)

---

> Última actualización: 2026-08-03
