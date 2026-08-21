# Backend Peajes — Índice

## Summary

Detalle de RPCs y flujos backend del dominio Peajes (documentos FC|NC, pasadas, plantillas, aliases). El catálogo resumido está en [functions/index.md](../functions/index.md).

## Index

- [Summary](#summary)
- [Documentos](#documentos)
- [Referencias](#referencias)

## Documentos

| Documento | Contenido |
|-----------|-----------|
| [confirmar-carga.md](./confirmar-carga.md) | `peajes_confirmar_carga` |
| [validacion-importes.md](./validacion-importes.md) | Neto, tolerancia, validación documento |
| [detectar-duplicados.md](./detectar-duplicados.md) | RN-16 |
| [gestion-pasadas.md](./gestion-pasadas.md) | List/CRUD pasadas |
| [estaciones-pendientes.md](./estaciones-pendientes.md) | Listado agregado estaciones PENDING (coords) |
| [plantillas-y-algoritmos-rpc.md](./plantillas-y-algoritmos-rpc.md) | Plantillas y algoritmos combinados |
| [aliases-estaciones.md](./aliases-estaciones.md) | Normalización y aliases AUSOL |
| [pwbi-views.md](./pwbi-views.md) | Vistas Power BI `pwbi_estacion` / `pwbi_patentes` / `pwbi_documentos` / `pwbi_tarifas` / `pwbi_pasadas` |
| [auditoria-tarifas.md](./auditoria-tarifas.md) | F14: tablas tarifas_* + 6 RPC peajes_* de normalización/auditoría |
| [auditoria-estaciones.md](./auditoria-estaciones.md) | F16: casos por fingerprint, listado, preview y corrección |
| [empresas-tarifa-url.md](./empresas-tarifa-url.md) | `empresas.tarifa_url` (link de tarifas desde auditoría) |

## Referencias

- Tablas: [docs/06-tablas/peajes/](../../06-tablas/peajes/INDEX.md)
- UI wizard: [docs/06-components/peajes/wizard.md](../../06-components/peajes/wizard.md)
- PRD: [peaje-prd-short.md.md](../../plan/peaje-prd-short.md.md)
- Migración F13: `supabase/migrations/20260807140000_peajes_documentos_tipo_nc.sql`
- Migración F08-2: `supabase/migrations/20260810142350_peajes_listar_estaciones_pendientes.sql`
- Migración Power BI: `20260810194113_peajes_pwbi_views.sql` + `20260811121811_peajes_pwbi_documentos.sql` + `20260818131012_peajes_pwbi_tarifas.sql`

---

> Última actualización: agosto 2026
