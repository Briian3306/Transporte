# Índice — Tablas Peajes (modelo de datos)

## Resumen

Documentación del esquema persistente del módulo Peajes (F01 + F13 documentos). Describe tablas, relaciones y apunta a RPCs en `docs/backend/`.

## Documentos

| Documento | Descripción |
|-----------|-------------|
| [modelo-datos.md](./modelo-datos.md) | Vista general, relaciones y reglas de dominio |
| [catalogos.md](./catalogos.md) | `peajes`, `estaciones`, `patentes`, `pases`, empresas |
| [documentos-pasadas.md](./documentos-pasadas.md) | `documentos`, `pasadas`, vistas |
| [tarifas-normalizadas.md](./tarifas-normalizadas.md) | F14: `tarifas_*` legado + columnas de auditoría en `pasadas` (compatibilidad retenida) |
| [tarifas-tarifa-importe.md](./tarifas-tarifa-importe.md) | F14-16: `tarifas` + `tarifa_importe` (sentido, puntero current, historia inmutable) |
| [plantillas-algoritmos.md](./plantillas-algoritmos.md) | Plantillas, configuraciones, algoritmos |
| [auditoria-y-rpcs.md](./auditoria-y-rpcs.md) | `registros_carga_peajes` + enlace a RPCs |

## Backend (RPCs)

| Path | Contenido |
|------|-----------|
| [docs/backend/](../../backend/index.md) | Catálogo y detalle de funciones Supabase |

## Verificación

```powershell
cd ibarra-app
npx supabase db reset --local --no-seed
npx supabase test db
```

Evidencia reciente: F13 → 75 PASS (`feature_list.json`).

---

> Última actualización: 2026-09-08
