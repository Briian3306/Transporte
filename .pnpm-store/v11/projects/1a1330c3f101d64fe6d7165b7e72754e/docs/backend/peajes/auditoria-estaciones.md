# Auditoría de estaciones — RPC (F16)

## Summary

`auditoria_estaciones_casos` persiste decisiones por fingerprint (`empresa|peaje|tipo|códigos|v1`). Listado `peajes_listar_auditoria_estaciones` (INVOKER). Transición `peajes_transicionar_caso_estacion`. Preview + corrección transaccional con hash; `SOLO_FUTUROS` vs `FUTUROS_E_HISTORICOS` (solo IDs del preview). pgTAP: `supabase/tests/peajes_auditoria_estaciones_test.sql`. Sin `SECURITY DEFINER`.
