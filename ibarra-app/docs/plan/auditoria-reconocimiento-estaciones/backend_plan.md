# Backend — Auditoría de reconocimiento de estaciones

Complemento de [PLAN_auditoria-reconocimiento-estaciones.md](./PLAN_auditoria-reconocimiento-estaciones.md). La bandeja persiste casos por fingerprint y sus estados `PENDIENTE`, `VALIDADO`, `DESCARTADO`, `REQUIERE_CORRECCION` y `CORREGIDO`, de modo que un caso revisado no vuelve a la bandeja salvo que cambien sus datos o algoritmo. El listado normaliza valores de catálogo/aliases, agrupa antes de paginar y expone perfiles de secuencia numérica. Varios códigos en una estación son válidos: solo alerta saltos/inversiones cuando, dentro de empresa+peaje, hay al menos tres valores distintos y una mayoría con paso 1.

La corrección tiene preview y confirmación. Puede actualizar exclusivamente catálogo/alias para futuras cargas o, con confirmación adicional, las pasadas exactas enumeradas por el preview. La ejecución es transaccional y guarda el antes/después; nunca toca el estado de Paso 6 ni aplica una corrección automática.

Secuencia obligatoria: pgTAP rojo con fixtures UUID transaccionales → migración verde → `npx supabase db reset --local --no-seed` → `npx supabase test db` → tipado → documentación con `backend-documenter` → verificación con `backend-tester`. No hay `db push --linked` sin autorización explícita.

La paginación, filtros y sort se validan en SQL; se revisa `EXPLAIN` antes de introducir índices. Mantener RLS y no emplear `SECURITY DEFINER` para evitar permisos.
