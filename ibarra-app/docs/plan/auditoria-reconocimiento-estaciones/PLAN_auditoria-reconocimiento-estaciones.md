# Auditoría y reconocimiento de estaciones — Plan de ejecución

> Solo plan; no implementar producto, SQL, rutas ni pruebas durante esta fase.

**Objetivo:** evitar que Paso 6 vuelva a exigir una estación cuando ya existe una relación guardada y válida, incluso si Excel cambia la representación numérica (`0001`/`1`, `0003`/`3`), y crear `/peajes/auditoria-estaciones` para revisar, resolver y no repetir anomalías de secuencias numéricas de proveedor sin tratar múltiples códigos válidos como errores.

**Fuente:** solicitud 2026-08-21; [reconocimiento-estaciones.md](../../06-components/peajes/reconocimiento-estaciones.md); PRD §§7.5 y 15; F02-13/F02-17/F09-1.  
**Estado:** planificado.

## Alcance y reglas

- Incluye restauración de `relacionesEstacion` y snapshots de plantilla por clave canónica; cadena Excel → Paso 6 → catálogo Supabase → selección en alcance; bandeja persistente de auditoría, estados, correcciones explícitas y trazabilidad; pantalla, pruebas y documentación.
- No incluye corrección automática ni intervención directa de la auditoría dentro de Paso 6, RLS nuevo, ni cambios remotos sin autorización explícita.
- `pasadas.estacion_id` permanece como única referencia; el peaje se deriva por estación. Se conserva la prioridad plantilla → alias de empresa → catálogo.
- El canónico aplica solo a cadenas de dígitos (sin ceros a la izquierda, incluido `0000` → `0`). Los valores alfanuméricos no pierden ceros.
- Varios `codigos_proveedor` en una estación son datos válidos. `['3','5']` no es hallazgo por cantidad: se muestra como contexto y solo se marca si rompe un patrón numérico secuencial que el auditor pueda revisar.
- Una relación guardada se identifica por `normalizarCodigoEstacion(valorProveedor)`, se revalida contra empresa/peaje/Concesión y, si sigue en alcance, se conserva sin volver a pedir selección. Solo una relación ausente, inválida o fuera de alcance abre Paso 6 como excepción.
- Sin empresa o con más de una candidata, el wizard nunca toma la primera: presenta sugerencias.
- La auditoría no llama al estado del wizard ni lo altera. Una corrección confirmada actualiza el catálogo/alias mediante su propia transacción; las cargas futuras se benefician de esa fuente existente y el Paso 6 conserva su prioridad normal.

## Hallazgo inicial

El helper ya compara valores numéricos equivalentes y el servicio consulta variantes. La probable ruptura está en el ciclo de vida: `relacionesEstacion` se guarda y luego se consulta por el valor crudo; si Excel/plantilla aporta otra representación del mismo número, Paso 6 no restaura la relación y vuelve a pedirla. La cobertura no crea una relación, recrea el componente y demuestra que puede continuar sin volver a seleccionar. Los UUID no se encuentran en migraciones locales: las pruebas Angular y pgTAP crearán fixtures transaccionales; una comprobación de DESARROLLO será exclusivamente de lectura.

## Contrato de Wave 0

Crear `models/auditoria-estaciones.contracts.ts` con token, filtros y página para el RPC `peajes_listar_auditoria_estaciones(p_filtros jsonb, p_page int, p_page_size int, p_sort text)`:

```ts
type HallazgoAuditoriaEstacion =
  | 'CODIGO_REPETIDO_ENTRE_ESTACIONES'
  | 'SECUENCIA_NUMERICA_CON_SALTO'
  | 'SECUENCIA_NUMERICA_INVERTIDA'
  | 'ALIAS_DIFERENTE_CATALOGO';

type EstadoCasoAuditoriaEstacion =
  | 'PENDIENTE'
  | 'VALIDADO'
  | 'DESCARTADO'
  | 'REQUIERE_CORRECCION'
  | 'CORREGIDO';

interface AuditoriaEstacionRow {
  empresaId: string; peajeId: string; estacionId: string;
  codigoProveedor: string; codigoNormalizado: string;
  fuentes: Array<'catalogo' | 'alias'>;
  codigosEstacion: string[]; estacionesMismoCodigo: number;
  secuenciaEsperada: { minimo: number; maximo: number; faltantes: number[] } | null;
  hallazgos: HallazgoAuditoriaEstacion[];
  casoId: string | null;
  estado: EstadoCasoAuditoriaEstacion;
  observacion: string | null;
  movimientosAfectados: number | null;
}
```

Cada anomalía lleva una huella estable (`empresa + peaje + tipo + códigos normalizados + algoritmo_version`). `auditoria_estaciones_casos` conserva la decisión de ese fingerprint, usuario, fecha, observación y corrección aplicada. Si cambia el conjunto de códigos o la versión del algoritmo, nace otro caso `PENDIENTE`; los validados/descartados no vuelven a la bandeja activa. El detector de secuencia opera por empresa+peaje y solo con códigos enteros: propone una secuencia cuando hay al menos tres valores distintos y la mayoría sigue incremento 1; enumera huecos (`3,5` ⇒ falta candidata `4`) o inversión.

El backend publica tres operaciones: listado de casos con estado, cambio de estado con observación, y `peajes_corregir_caso_estacion`. Esta última exige el caso `REQUIERE_CORRECCION`, destino de estación y confirmación del auditor; primero devuelve una previsualización de catálogo/aliases y movimientos potenciales. La ejecución final es transaccional, registra antes/después y puede elegir: **solo prevenir futuros movimientos** (catálogo/alias) o **prevenir + corregir movimientos históricos previsualizados**. No modifica movimientos que no estén en el alcance exacto confirmado.

## Olas y responsables

| Ola | Tareas | Puerta | Paralelismo |
|---|---|---|---|
| 0 | F16-0 contratos y criterios | contrato publicado | serie |
| 1 | F16-1 backend y F16-2 frontend | F16-0 verde | paralelo; archivos disjuntos |
| 2 | F16-3 documentación/QA/integración | F16-1/F16-2 verdes | serie |

| Task | Owner | Skills | Archivos de propiedad |
|---|---|---|---|
| F16-0 | `00-orquestador-setup` | `test-driven-development` | `src/app/components/peajes/models/auditoria-estaciones.contracts.ts`, `models/index.ts` |
| F16-1 | `01-backend-supabase` | `backend-supabase-write`, `supabase`, `supabase-postgres-best-practices`, `test-driven-development` | migración nueva, `supabase/tests/peajes_auditoria_estaciones_test.sql`, `services/peajes-auditoria-estaciones.service.ts`, `services/index.ts`, `docs/backend/**` |
| F16-2 | `02-frontend-wizard-tablas` | `peajes-wizard-tablas`, `frontend-design`, `test-driven-development` | `wizard/paso6-estaciones/**`, `wizard/mocks/peajes-catalogo.mock.ts`, nuevo `auditoria-estaciones/**` |
| F16-3 | `04-documentador` + `05-integrador-qa` | `documentacion-proyecto`, `backend-documenter`, `backend-tester`, `playwright-best-practices` | docs: 04; ruta/home/permisos, QA y evidencias: 05 |

## Tareas detalladas

### F16-0 — Contrato canónico

- [ ] Red: specs de contrato/mapper que fallen por token/tipos ausentes, por no poder resolver una clave de relación canónica y por estados/transiciones de caso desconocidos.
- [ ] Verde: publicar tipos cerrados de filtros, paginación, fila, estados/transiciones, previsualización/corrección y la utilidad de identidad de relación; no duplicar entidades de catálogo.
- [ ] Evidencia: `npx tsc --noEmit -p tsconfig.app.json` y `npx tsc --noEmit -p tsconfig.spec.json` exit 0.

### F16-1 — Backend y servicio Supabase

- [ ] Red: crear migración con `npx supabase migration new peajes_auditoria_estaciones` y pgTAP transaccional que use los UUID reportados. Debe fallar antes de la implementación para: secuencia `1,2,3,5` (hueco `4`), estado persistente que evita reabrir el mismo fingerprint, cambio de fuente que crea nuevo caso y corrección sin previsualización/confirmación rechazada.
- [ ] Verde: normalizador SQL coherente con frontend; listado paginado; tabla de casos con fingerprint, estado y evidencia; RPC para transición; RPC de preview y RPC transaccional de corrección. `['3','5']` se devuelve completo como contexto, sin hallazgo automático si no existe perfil secuencial suficiente.
- [ ] Corrección segura: la acción "solo futuros" crea/ajusta la relación de catálogo/alias elegida; "futuros + históricos" actualiza exclusivamente las pasadas enumeradas por el preview, con registro inmutable de IDs, estación anterior/nueva y caso. No se permite ejecutar la segunda modalidad cuando el preview cambió o el caso no está en `REQUIERE_CORRECCION`.
- [ ] Performance/seguridad: revisar `EXPLAIN` antes de añadir índices; preservar RLS y no usar `SECURITY DEFINER` como atajo.
- [ ] Verificar: `npx supabase db reset --local --no-seed`; `npx supabase test db`; `npx tsc --noEmit -p tsconfig.app.json`.
- [ ] Tras verde, documentar estados, transiciones, preview/corrección, trazabilidad, RPC/seguridad/pruebas en `docs/backend/functions/index.md`, nuevo `docs/backend/peajes/auditoria-estaciones.md` e índice Peajes.

### F16-2 — Paso 6 y pantalla

- [ ] Red Paso 6: crear una relación válida, destruir/recrear Paso 6 y comprobar que puede continuar sin pedir selección. Repetir con `0001` guardado/`1` recibido y `3` guardado/`0003` recibido para los UUID reportados; cubrir empresa incorrecta y Concesión fuera de alcance, que sí deben pedir corrección.
- [ ] Verde Paso 6: resolver/restaurar por clave canónica y conservar relaciones válidas antes de invocar reconocimiento. No hardcodear UUID ni autoasignar fuera de `estacionOptionsFor()`.
- [ ] Red auditoría: specs de bandeja por estado, carga/error/vacío, badges y fila expandible para secuencia `1,2,3,5` con hueco `4`; `['3','5']` aislado debe mostrarse sin alarma. Un caso validado/descartado no debe aparecer en Pendientes al recargar.
- [ ] Verde auditoría: componente standalone responsive con filtros por estado y una vista de detalle. El detalle permite Validar, Descartar o Marcar para corregir con observación; la corrección abre preview, explica el alcance y exige confirmar la modalidad "solo futuros" o "futuros + históricos". Provider de ruta local y mock tipado hasta F16-1. No tocar el estado de Paso 6.
- [ ] Verificar: `ng test --include="**/peajes/wizard/paso6-estaciones/**/*.spec.ts" --watch=false --browsers=ChromeHeadless`; `ng test --include="**/peajes/auditoria-estaciones/**/*.spec.ts" --watch=false --browsers=ChromeHeadless`; tipado app/spec.

### F16-3 — Documentación, integración y QA

- [ ] 04 actualiza `reconocimiento-estaciones.md`, crea `auditoria-estaciones.md`, y actualiza índices/componentes/módulo solo después de features verdes.
- [ ] 05 agrega fragmento de ruta, tarjeta “Auditoría de estaciones” y `peajes:read` siguiendo el patrón de tarifas; sus specs deben fallar antes del cableado.
- [ ] Backend-tester repite reset + pgTAP local. QA ejecuta specs focalizadas, tsc y `npm run build`; marca `passing` solo con evidencia real.
- [ ] Smoke opcional DESARROLLO: solo SELECT de ambos UUID/códigos/empresa/peaje y casos de auditoría. Si no coinciden con el reporte, registrar bloqueo de datos para una feature posterior; no actualizar.

## Matriz de verificación

| Nivel | Comando/acción | Resultado esperado |
|---|---|---|
| Paso 6 | `ng test --include="**/peajes/wizard/paso6-estaciones/**/*.spec.ts" --watch=false --browsers=ChromeHeadless` | relación guardada persiste tras recrear componente y respeta claves numéricas equivalentes |
| Auditoría UI | `ng test --include="**/peajes/auditoria-estaciones/**/*.spec.ts" --watch=false --browsers=ChromeHeadless` | secuencia con hueco visible; estados persisten; preview exige confirmación |
| DB | `npx supabase db reset --local --no-seed`; `npx supabase test db` | pgTAP verde con casos, perfil secuencial, transición y corrección trazable |
| Build | `npx tsc --noEmit -p tsconfig.app.json`; `npx tsc --noEmit -p tsconfig.spec.json`; `npm run build` | exit 0 |
| Visual | `/peajes/auditoria-estaciones`, filtrar el peaje con `1,2,3,5`, cambiar estado y abrir preview | caso no se repite tras validación; corrección requiere confirmación explícita |

## Riesgos y decisiones

1. La secuencia es una recomendación: se exige evidencia de perfil numérico (≥3 códigos distintos y mayoría con paso 1) antes de alertar. Una configuración de varios códigos sin perfil no es un error.
2. La corrección de movimientos históricos es una operación sensible: se limitará al conjunto devuelto por preview y quedará trazada. La primera entrega puede quedar bloqueada si no existe un identificador de fuente suficiente para seleccionar pasadas de modo determinista; en ese caso solo se habilita "solo futuros" hasta definirlo.
3. Si los UUID de DESARROLLO no contienen los códigos reportados, tratarlo como remediación de datos separada.
3. `npx supabase status --output json` falló en este sandbox porque la CLI intenta escribir telemetría fuera del workspace; no impide la ejecución con CLI/permiso local disponible.
