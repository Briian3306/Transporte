# Aliases y normalización de estaciones

## Summary

Helpers SQL para normalizar textos de estación y mantener aliases proveedor↔estación (AUSOL / Acceso Oeste).

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Functions](#functions)
- [Tables](#tables)
- [Testing](#testing)
- [Notes](#notes)

## Purpose

Mejorar el reconocimiento de estaciones en importación sin confundir alias de empresa con el snapshot de plantilla (prioridad: plantilla → alias empresa → reconocimiento normal).

## Functions

| Función | Tipo | Descripción |
|---------|------|-------------|
| `peajes_normalizar_estacion` | SQL | Normaliza texto |
| `peajes_validar_alias_estacion` | trigger fn | Valida alias |
| `peajes_sincronizar_alias_estacion` | trigger fn | Sync alias |

**Ubicación:** `supabase/migrations/20260803183951_peajes_ausol_estaciones_aliases.sql`.

## Tables

| Tabla | Rol |
|-------|-----|
| `estaciones_alias_proveedor` (o equivalente en migración) | aliases |
| `estaciones` | destino |

## Testing

| Tipo | Archivo | Escenario |
|------|---------|-----------|
| `supabase_db_test` | `peajes_ausol_estaciones_aliases_test.sql` | Normalización / alias |

**Estado:** verificado (tests AUSOL aliases)

## Notes

- UI Paso 6: [reconocimiento-estaciones.md](../../06-components/peajes/reconocimiento-estaciones.md)

---

> Última actualización: agosto 2026
