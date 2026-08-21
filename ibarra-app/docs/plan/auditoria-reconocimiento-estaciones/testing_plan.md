# Pruebas — Auditoría de reconocimiento de estaciones

1. Puras: equivalencia numérica, clave canónica de relación y ámbito empresa/peaje.
2. Paso 6: guardar relación, recrear componente y continuar; preview Excel con representaciones numéricas alternativas.
3. DB local: fixtures UUID, RPC, perfil de secuencia `1,2,3,5`, fingerprint, estados, preview, corrección transaccional y aislamiento entre empresas.
4. Vista: mock tipado, filtros, hallazgos, persistencia de estado, preview y confirmación.
5. Integración: provider/ruta/tarjeta, build y smoke visual.

No regresiones: `0001` compartido sin empresa permanece en sugerencias; `['3','5']` aislado no genera alarma, bloquea ni modifica una carga; una auditoría validada/descartada no vuelve a Pendientes con el mismo fingerprint; no se agrega `peaje_id` a `pasadas`; Supabase CLI local, no DESARROLLO, decide la aprobación SQL.
