# Guía — Catálogos Peajes (UI)

## Resumen

Pantallas CRUD de catálogos del dominio Peajes (F02-3…F02-5 `passing`): peajes, estaciones, patentes y pases. Usan el token `PEAJES_CATALOGO_SERVICE` (hoy mock; servicio Supabase real disponible).

## Índice

- [Resumen](#resumen)
- [Estructura](#estructura)
- [Rutas](#rutas)
- [Comportamiento](#comportamiento)
- [Providers](#providers)
- [Verificación](#verificación)
- [Referencias](#referencias)

---

## Estructura

```text
src/app/components/peajes/catalogos/
  peajes-catalogos-home.component.*
  peajes/catalogo-peajes.component.*
  estaciones/catalogo-estaciones.component.*
  patentes/catalogo-patentes.component.*
  pases/catalogo-pases.component.*
  catalogos.routes.ts
  catalogos.providers.ts
```

---

## Rutas

Fragmento `PEAJES_CATALOGOS_ROUTES` (merge pendiente 05):

| Path | Componente |
|------|------------|
| `/peajes/catalogos` | Home catálogos |
| `/peajes/catalogos/peajes` | Catálogo peajes |
| `/peajes/catalogos/estaciones` | Catálogo estaciones |
| `/peajes/catalogos/patentes` | Catálogo patentes |
| `/peajes/catalogos/pases` | Catálogo pases |

---

## Comportamiento

- Listado y alta/edición vía interfaz `PeajesCatalogoService`.
- Estaciones ligadas a `peaje_id`; `codigos_proveedor` para sugerencias del wizard.
- Patentes: categoría `TRANSPORTE` \| `REMIS`.
- Pases: asociados a una patente.
- Formularios con `inject(FormBuilder)` (corrige error histórico `fb used before initialization`).

---

## Providers

Hoy: `PeajesCatalogoMockService` en `catalogos.routes.ts` / providers de catálogos.

Swap objetivo (05):

```ts
{ provide: PEAJES_CATALOGO_SERVICE, useExisting: PeajesCatalogoSupabaseService }
```

---

## Verificación

Incluida en la suite wizard+catalogos: **12 SUCCESS** (ver [wizard.md](./wizard.md)).

---

## Referencias

- Tablas: [docs/06-tablas/peajes/catalogos.md](../../06-tablas/peajes/catalogos.md)
- Servicio real: `services/peajes-catalogo.service.ts`

---

> Última actualización: julio 2026
