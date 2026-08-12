# RPC Functions — Resumen

## Summary

Catálogo de funciones RPC Postgres del módulo Peajes. El detalle de negocio está en [peajes/](../peajes/index.md). Fuente: `supabase/migrations/*peajes*.sql` (última migración gana).

## Index

- [Summary](#summary)
- [Purpose](#purpose)
- [Functions](#functions)
- [Notes](#notes)

## Purpose

Ofrecer un índice rápido nombre → módulo → documento de detalle, sin duplicar la lógica completa.

## Functions

| Función | Módulo | Propósito | Detalle |
|---------|--------|-----------|---------|
| `peajes_tolerancia_importe` | peajes | Constante 0.01 (centavo RN-11) | [validacion-importes](../peajes/validacion-importes.md) |
| `peajes_calcular_importe_neto` | peajes | `precio - bonificacion` (FC/NC firmados) | [validacion-importes](../peajes/validacion-importes.md) |
| `peajes_validar_factura_pasadas` | peajes | Suma neto vs subtotal; tolerancia default 1% | [validacion-importes](../peajes/validacion-importes.md) |
| `peajes_validar_documento_id` | peajes | Valida documento persistido por id | [validacion-importes](../peajes/validacion-importes.md) |
| `peajes_validar_factura_id` | peajes | Alias compat → `validar_documento_id` | [validacion-importes](../peajes/validacion-importes.md) |
| `peajes_detectar_duplicados` | peajes | Clave RN-16 lote + BD | [detectar-duplicados](../peajes/detectar-duplicados.md) |
| `peajes_confirmar_carga` | peajes | Inserta documento + pasadas + auditoría; persiste `categoria` (F14) | [confirmar-carga](../peajes/confirmar-carga.md) |
| `peajes_normalizar_tarifas` | peajes | Worker post-carga de niveles tarifarios | [auditoria-tarifas](../peajes/auditoria-tarifas.md) |
| `peajes_recalcular_tarifas` | peajes | Recálculo completo por peaje | [auditoria-tarifas](../peajes/auditoria-tarifas.md) |
| `peajes_confirmar_status_tarifa` | peajes | Confirma status N niveles → pasadas | [auditoria-tarifas](../peajes/auditoria-tarifas.md) |
| `peajes_marcar_diagnostico_tarifa` | peajes | Marca CATEGORIA/REVISAR | [auditoria-tarifas](../peajes/auditoria-tarifas.md) |
| `peajes_listar_tarifas_normalizadas` | peajes | Listado paginado auditoría | [auditoria-tarifas](../peajes/auditoria-tarifas.md) |
| `peajes_grupos_similares_tarifa` | peajes | Familias con mismo ratio max/min | [auditoria-tarifas](../peajes/auditoria-tarifas.md) |
| `peajes_listar_pasadas` | peajes | Listado paginado gestión | [gestion-pasadas](../peajes/gestion-pasadas.md) |
| `peajes_listar_estaciones_pendientes` | peajes | Agregado estaciones PENDING (coords) | [estaciones-pendientes](../peajes/estaciones-pendientes.md) |
| `peajes_crear_pasada` | peajes | Alta manual pasada | [gestion-pasadas](../peajes/gestion-pasadas.md) |
| `peajes_actualizar_pasada` | peajes | Patch pasada | [gestion-pasadas](../peajes/gestion-pasadas.md) |
| `peajes_eliminar_pasada` | peajes | Baja pasada | [gestion-pasadas](../peajes/gestion-pasadas.md) |
| `peajes_sobrescribir_configuraciones_plantilla` | peajes | Replace transaccional configs | [plantillas-y-algoritmos-rpc](../peajes/plantillas-y-algoritmos-rpc.md) |
| `peajes_validar_algoritmo_combinado` | peajes | Códigos + orden | [plantillas-y-algoritmos-rpc](../peajes/plantillas-y-algoritmos-rpc.md) |
| `peajes_expandir_algoritmo` | peajes | Lista pasos ordenados | [plantillas-y-algoritmos-rpc](../peajes/plantillas-y-algoritmos-rpc.md) |
| `peajes_guardar_algoritmo_combinado` | peajes | Persistencia + validación | [plantillas-y-algoritmos-rpc](../peajes/plantillas-y-algoritmos-rpc.md) |
| `peajes_guardar_plantilla_importacion` | peajes | Snapshot plantilla + estaciones | [plantillas-y-algoritmos-rpc](../peajes/plantillas-y-algoritmos-rpc.md) |
| `peajes_normalizar_estacion` | peajes | Normaliza texto estación/alias | [aliases-estaciones](../peajes/aliases-estaciones.md) |
| `peajes_validar_alias_estacion` | peajes | Trigger validación alias | [aliases-estaciones](../peajes/aliases-estaciones.md) |
| `peajes_sincronizar_alias_estacion` | peajes | Trigger sync alias | [aliases-estaciones](../peajes/aliases-estaciones.md) |

Helpers internos / triggers de `updated_at` (`peajes_set_updated_at`) no se listan como API de producto.

## Notes

- No hay Edge Functions Deno para Peajes MVP: [edge/](./edge/index.md).
- Consumo Angular: `src/app/components/peajes/services/`.

---

> Última actualización: agosto 2026
