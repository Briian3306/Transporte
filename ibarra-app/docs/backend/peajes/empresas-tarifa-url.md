# Empresas — tarifa_url

## Summary

Columna `empresas.tarifa_url` para guardar el link público a la tabla de tarifas de cada empresa/concesión. La auditoría de tarifas lo usa en la columna Peaje: el nombre abre la URL y el lápiz la edita.

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Business Logic](#business-logic)
- [Relations](#relations)
- [Tables](#tables)
- [Validations](#validations)
- [Testing](#testing)
- [Notes](#notes)

## Purpose

El analista necesita abrir la tarifa oficial de la concesión (p. ej. AUSA) sin salir de `/peajes/auditoria-tarifas`, y poder cargar o corregir esa URL.

## Business Logic

1. `peajes.empresa_id` (text) apunta a `empresas.id::text`.
2. Si `empresas.tarifa_url` tiene valor, el nombre del peaje es un hipervínculo.
3. El lápiz llama `UPDATE empresas SET tarifa_url = …` vía `PeajesCatalogoSupabaseService.actualizarEmpresa`.
4. Vacío se guarda como `NULL` (el peaje queda como texto, sin link).

Seed inicial: empresa `AUSA` → `https://www.ausa.com.ar/sections/tarifas.html`.

## Relations

| Entidad / módulo | Relación |
|------------------|----------|
| `peajes` | `empresa_id` = `empresas.id::text` |
| Auditoría de tarifas | UI de lectura/edición de `tarifa_url` |
| Catálogo empresas | Alta de empresa; la URL se edita en auditoría |

## Tables

| Tabla | Rol |
|-------|-----|
| `empresas` | Escritura de `tarifa_url` |

No hay RPC nuevo: el cliente autenticado actualiza la fila (RLS `empresas_authenticated_all` sin cambio).

## Validations

- Nullable.
- CHECK `empresas_tarifa_url_http_chk`: `NULL` o `^https?://` sin espacios.
- La UI rechaza el mismo patrón antes de guardar.

## Testing

> Verificación: skill `backend-tester`.

| Tipo | Archivo / comando esperado | Escenario |
|------|----------------------------|-----------|
| pgTAP | `supabase/tests/peajes_empresas_tarifa_url_test.sql` | Columna nullable + constraint |
| CLI | `npx supabase test db` | Incluye el test anterior |
| Angular | `auditoria-tarifas-list.component.spec.ts` | Resuelve URL, abre diálogo, rechaza esquema inválido |

## Notes

- Migración local: `supabase/migrations/20260813195728_peajes_empresas_tarifa_url.sql`.
- Aplicada en DESARROLLO (`kfffigvyvtzyczeiadxh`) vía MCP `apply_migration` (`peajes_empresas_tarifa_url`).
- No se agrega `peaje_id` a `pasadas` (RN-05).
