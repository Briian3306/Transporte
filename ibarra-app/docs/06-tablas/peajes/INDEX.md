# Índice — Tablas Peajes (modelo de datos)

## Resumen

Documentación del esquema persistente del módulo Peajes implementado en Fase 1 (F01-1…F01-9, `passing`). Describe tablas, relaciones, RPCs y reglas verificadas en Supabase CLI. No documenta features no implementadas (E2E §21, merge de rutas, push DESARROLLO).

## Documentos

| Documento | Descripción |
|-----------|-------------|
| [modelo-datos.md](./modelo-datos.md) | Vista general, relaciones y reglas de dominio |
| [catalogos.md](./catalogos.md) | `peajes`, `estaciones`, `patentes`, `pases` |
| [facturas-pasadas.md](./facturas-pasadas.md) | `facturas`, `pasadas`, vista `pasadas_con_peaje` |
| [plantillas-algoritmos.md](./plantillas-algoritmos.md) | Plantillas, configuraciones, algoritmos y catálogo |
| [auditoria-y-rpcs.md](./auditoria-y-rpcs.md) | `registros_carga_peajes` y RPCs de validación/carga |

## SQL companion (Agente 01)

| Path | Contenido |
|------|-----------|
| [docs/08-sql/peajes/F01-schema/](../../08-sql/peajes/F01-schema/README.md) | Migraciones de esquema |
| [docs/08-sql/peajes/F01-rpc/](../../08-sql/peajes/F01-rpc/README.md) | RPCs y auditoría |

## Verificación ejecutada

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed   # OK — 5 migraciones
npx supabase test db                      # PASS 30/30 (peajes_f01_test.sql)
```

---

> Última actualización: julio 2026
