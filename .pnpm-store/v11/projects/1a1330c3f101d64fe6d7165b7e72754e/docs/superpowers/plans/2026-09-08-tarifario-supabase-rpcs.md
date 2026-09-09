# Tarifario Supabase RPCs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing Angular Tarifario (`/peajes/tarifario`) to local Supabase CLI tables `tarifas` + `tarifa_importe` through four INVOKER RPCs, then swap the route provider off the in-memory mock.

**Architecture:** Do not create or alter F14-16 tables. The UI already talks only to `PEAJES_TARIFARIO_SERVICE`. This plan adds `peajes_listar_tarifas_actuales`, `peajes_obtener_tarifario_editor`, `peajes_guardar_tarifas_actuales`, and `peajes_listar_tarifa_historial` (SECURITY INVOKER), implements `PeajesTarifarioSupabaseService` with the same method signatures as the mock, and changes one `useClass` line in `tarifario.routes.ts`. Save appends a new `tarifa_importe` row; the existing trigger `trg_tarifa_importe_promote` retargets `current_tarifa_id`. Do not UPDATE historical importe rows.

**Tech Stack:** Postgres 15 (Supabase CLI), plpgsql SECURITY INVOKER, pgTAP, Angular 19 standalone, `SupabaseService.executeWithRetry` + `client.rpc`.

**Spec:** [docs/06-components/peajes/tarifario.md](../../06-components/peajes/tarifario.md) (UI + frozen RPC names) and [docs/06-tablas/peajes/tarifas-tarifa-importe.md](../../06-tablas/peajes/tarifas-tarifa-importe.md) (tables already applied by F14-16). Feature: **F14-17**. Depends on **F14-16** `passing` on CLI.

## Global Constraints

- UI copy in Spanish. Components must keep injecting `PEAJES_TARIFARIO_SERVICE` only — no import of `TarifarioMockService` or `PeajesTarifarioSupabaseService` in list/editor/dialog.
- Do not CREATE TABLE. Schema already lives in `supabase/migrations/20260907100000_peajes_tarifas_v2_schema.sql` and `20260907101000_peajes_tarifas_v2_current_pointer.sql`.
- Do not DROP, rename, or write to `tarifas_normalizadas`. Do not change `pasadas.tarifa_normalizada_id`.
- `sentido` is never null: `IDA` | `VUELTA` | `AMBAS`. IDA does not load VUELTA. IDA does not load AMBAS. AMBAS is a real third value.
- Current list price = `tarifas.current_tarifa_id → tarifa_importe.importe`. Never list every historical amount.
- Empty New is omitted by the UI (`collectCambios`). RPC receives only that array. Missing current importe = JSON `null`, never `0`.
- `tarifa_importe.importe` has `CHECK (importe > 0)`. RPC must reject `importe <= 0` with `ERRCODE = '23514'`. Do not store `0`.
- `tarifa_importe` is immutable (trigger). Corrections = INSERT. Never UPDATE `importe` / `fecha_aparicion`. Do not DELETE.
- `tarifas.fecha_actualizacion` is `NOT NULL` with no default. New `tarifas` rows must set it to `now()` (or the same stamp as the first `fecha_aparicion`); the promote trigger then copies `fecha_aparicion`.
- New `tarifas` rows: `requiere_normalizacion_iva = false`, `current_tarifa_id = NULL` until the first `tarifa_importe` INSERT (MATCH SIMPLE allows NULL).
- Unique identity: `(peaje_id, estacion_id, status, categoria, sentido)`. `categoria` 0–10.
- RPCs: `LANGUAGE plpgsql SECURITY INVOKER`, `SET search_path = public`. `GRANT EXECUTE` to `authenticated, service_role`. `REVOKE ALL FROM PUBLIC`.
- Work only on local CLI. Never `db push --linked`. Never write DESARROLLO. No commit unless the human asks (include commit steps anyway; skip them if they did not ask).
- PowerShell: chain with `;`, not `&&`. Commands run from `ibarra-app`.
- Angular tests: `pnpm exec ng test --include="…" --watch=false --browsers=ChromeHeadless`.

---

## File map

| Path | Role |
|------|------|
| `ibarra-app/supabase/migrations/20260908140000_peajes_tarifario_rpcs.sql` | Four Tarifario RPCs + grants. No DDL. |
| `ibarra-app/supabase/tests/peajes_tarifario_rpc_test.sql` | pgTAP: list current-only, sentido isolation, empty editor, append-only save, create-missing, bulk omit empty, history `es_actual`. |
| `ibarra-app/src/app/components/peajes/services/peajes-tarifario.service.ts` | `PeajesTarifarioSupabaseService implements PeajesTarifarioService` |
| `ibarra-app/src/app/components/peajes/services/peajes-tarifario.service.spec.ts` | RPC argument mapping against a fake `SupabaseService` |
| `ibarra-app/src/app/components/peajes/services/index.ts` | Export the new class |
| `ibarra-app/src/app/components/peajes/tarifario/tarifario.routes.ts` | `useClass: PeajesTarifarioSupabaseService` |
| `ibarra-app/docs/06-components/peajes/tarifario.md` | Provider is now Supabase |
| `ibarra-app/docs/backend/peajes/tarifario.md` | RPC signatures (create this file) |
| `ibarra-app/docs/backend/peajes/index.md` | Link the new backend doc |
| `ibarra-app/docs/06-components/peajes/servicios-y-providers.md` | Swap row |
| `ibarra-app/feature_list.json` | F14-17 verification + evidence |
| `ibarra-app/docs/claude-progress.md` / `docs/session-handoff.md` | Bitácora |

Do **not** edit list/editor/dialog templates in this plan except if the provider swap forces a compile error (it must not).

Do **not** create `peajes-tarifario.service.ts` that talks to `.from('tarifas')` directly for save. History is append-only via RPC so the trigger runs once per INSERT inside one transaction.

---

## Existing tables (read-only for this plan)

`public.tarifas` (no money):

- `id uuid PK`
- `peaje_id uuid NOT NULL → peajes`
- `estacion_id uuid NOT NULL → estaciones`
- `status text NOT NULL` CHECK `PICO` \| `NO_PICO`
- `categoria smallint NOT NULL` 0–10
- `sentido text NOT NULL` `IDA` \| `VUELTA` \| `AMBAS`
- `requiere_normalizacion_iva boolean NOT NULL DEFAULT false`
- `current_tarifa_id uuid NULL` composite FK `(id, current_tarifa_id) → tarifa_importe(tarifa_id, id)` MATCH SIMPLE
- `fecha_actualizacion timestamptz NOT NULL`
- UNIQUE `(peaje_id, estacion_id, status, categoria, sentido)`

`public.tarifa_importe` (history):

- `id uuid PK`
- `tarifa_id uuid NOT NULL → tarifas`
- `importe numeric(14,2) NOT NULL CHECK (importe > 0)`
- `fecha_aparicion timestamptz NOT NULL`
- UNIQUE `(tarifa_id, id)`
- AFTER INSERT `trg_tarifa_importe_promote` sets `tarifas.current_tarifa_id` and `fecha_actualizacion` when the new row is strictly later

Angular contract already frozen in `models/tarifario.contracts.ts`:

```ts
listar(params: TarifarioListParams): Observable<TarifarioListResult>
obtenerEditor(peajeId, estacionId, sentido: TarifaSentido): Observable<TarifarioEditorPayload>
guardar(peajeId, estacionId, sentido, cambios: TarifarioImporteCambio[]): Observable<{ actualizadas: number }>
listarHistorial(tarifaId: string): Observable<TarifarioHistorialItem[]>
```

`TarifarioImporteCambio`: `{ categoria: number; status: 'PICO' | 'NO_PICO'; importe: number }`.

---

### Task 1: pgTAP RED — RPC names and save/list semantics

**Files:**
- Create: `ibarra-app/supabase/tests/peajes_tarifario_rpc_test.sql`
- Test: same file (pgTAP is the test)

**Interfaces:**
- Consumes: F14-16 tables + promote/immutable triggers
- Produces: failing assertions that the four functions exist and that HUDSON-style fixtures isolate IDA/VUELTA, append history, and treat empty editor as success

- [ ] **Step 1: Write the failing pgTAP file**

Use a dedicated UUID namespace so this file does not collide with `peajes_f14_tarifas_importe_test.sql` (`16200000-…`).

```sql
-- pgTAP: F14-17 Tarifario RPCs (list / editor / save / history)
BEGIN;
SELECT plan(16);

SELECT has_function(
  'public',
  'peajes_listar_tarifas_actuales',
  ARRAY['jsonb', 'integer', 'integer', 'text'],
  'F14-17 peajes_listar_tarifas_actuales(jsonb,int,int,text)'
);
SELECT has_function(
  'public',
  'peajes_obtener_tarifario_editor',
  ARRAY['uuid', 'uuid', 'text'],
  'F14-17 peajes_obtener_tarifario_editor(uuid,uuid,text)'
);
SELECT has_function(
  'public',
  'peajes_guardar_tarifas_actuales',
  ARRAY['uuid', 'uuid', 'text', 'jsonb'],
  'F14-17 peajes_guardar_tarifas_actuales(uuid,uuid,text,jsonb)'
);
SELECT has_function(
  'public',
  'peajes_listar_tarifa_historial',
  ARRAY['uuid'],
  'F14-17 peajes_listar_tarifa_historial(uuid)'
);

INSERT INTO public.peajes (id, nombre) VALUES
  ('17400000-aaaa-4aa1-8aa1-000000000001', 'AUBASA F14-17');

INSERT INTO public.estaciones (id, peaje_id, nombre) VALUES
  ('17400000-aaaa-4aa1-8aa1-000000000010', '17400000-aaaa-4aa1-8aa1-000000000001', 'HUDSON'),
  ('17400000-aaaa-4aa1-8aa1-000000000011', '17400000-aaaa-4aa1-8aa1-000000000001', 'VACIA');

-- HUDSON IDA cat 1 NO_PICO: history 5000 then current 5500
INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  fecha_actualizacion
) VALUES (
  '17400000-aaaa-4aa1-8aa1-000000000050',
  '17400000-aaaa-4aa1-8aa1-000000000001',
  '17400000-aaaa-4aa1-8aa1-000000000010',
  'NO_PICO', 1, 'IDA',
  '2026-03-10T00:00:00Z'
);

INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion) VALUES
  ('17400000-aaaa-4aa1-8aa1-000000000099',
   '17400000-aaaa-4aa1-8aa1-000000000050',
   5000, '2025-08-21T00:00:00Z');

INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion) VALUES
  ('17400000-aaaa-4aa1-8aa1-000000000100',
   '17400000-aaaa-4aa1-8aa1-000000000050',
   5500, '2026-03-10T00:00:00Z');

INSERT INTO public.tarifas (
  id, peaje_id, estacion_id, status, categoria, sentido,
  fecha_actualizacion
) VALUES (
  '17400000-aaaa-4aa1-8aa1-000000000051',
  '17400000-aaaa-4aa1-8aa1-000000000001',
  '17400000-aaaa-4aa1-8aa1-000000000010',
  'NO_PICO', 1, 'VUELTA',
  '2026-03-10T00:00:00Z'
);

INSERT INTO public.tarifa_importe (id, tarifa_id, importe, fecha_aparicion) VALUES
  ('17400000-aaaa-4aa1-8aa1-000000000110',
   '17400000-aaaa-4aa1-8aa1-000000000051',
   5700, '2026-03-10T00:00:00Z');

-- list: current 5500 only; 5000 must not appear as a row
SELECT ok(
  (
    SELECT (r -> 0 ->> 'importe')::numeric = 5500
       AND (r -> 0 ->> 'current_tarifa_importe_id')
           = '17400000-aaaa-4aa1-8aa1-000000000100'
    FROM (
      SELECT public.peajes_listar_tarifas_actuales(
        jsonb_build_object(
          'estacion_ids', jsonb_build_array('17400000-aaaa-4aa1-8aa1-000000000010'),
          'sentidos', jsonb_build_array('IDA'),
          'categorias', jsonb_build_array(1),
          'status', jsonb_build_array('NO_PICO')
        ),
        1, 50, 'categoria:asc'
      ) -> 'rows' AS r
    ) s
  ),
  'F14-17 listar solo importe current IDA 5500'
);

SELECT is(
  (
    SELECT count(*)::int
    FROM jsonb_array_elements(
      public.peajes_obtener_tarifario_editor(
        '17400000-aaaa-4aa1-8aa1-000000000001',
        '17400000-aaaa-4aa1-8aa1-000000000010',
        'IDA'
      ) -> 'existentes'
    ) e
    WHERE (e ->> 'importe')::numeric = 5700
  ),
  0,
  'F14-17 editor IDA no incluye VUELTA 5700'
);

SELECT is(
  (
    SELECT jsonb_array_length(
      public.peajes_obtener_tarifario_editor(
        '17400000-aaaa-4aa1-8aa1-000000000001',
        '17400000-aaaa-4aa1-8aa1-000000000011',
        'IDA'
      ) -> 'existentes'
    )
  ),
  0,
  'F14-17 editor vacio es exito con existentes []'
);

SELECT lives_ok(
  $$SELECT public.peajes_guardar_tarifas_actuales(
      '17400000-aaaa-4aa1-8aa1-000000000001',
      '17400000-aaaa-4aa1-8aa1-000000000010',
      'IDA',
      '[{"categoria":1,"status":"NO_PICO","importe":5800}]'::jsonb
    )$$,
  'F14-17 guardar append 5800'
);

SELECT is(
  (
    SELECT importe FROM public.tarifa_importe
    WHERE id = '17400000-aaaa-4aa1-8aa1-000000000099'
  ),
  5000::numeric,
  'F14-17 historial TI-099 intacto'
);

SELECT is(
  (
    SELECT importe FROM public.tarifa_importe
    WHERE id = '17400000-aaaa-4aa1-8aa1-000000000100'
  ),
  5500::numeric,
  'F14-17 historial TI-100 intacto'
);

SELECT is(
  (
    SELECT ti.importe
    FROM public.tarifas t
    JOIN public.tarifa_importe ti ON ti.id = t.current_tarifa_id
    WHERE t.id = '17400000-aaaa-4aa1-8aa1-000000000050'
  ),
  5800::numeric,
  'F14-17 current apunta a 5800'
);

SELECT ok(
  (
    SELECT bool_or((h ->> 'es_actual')::boolean AND (h ->> 'importe')::numeric = 5800)
       AND bool_or(NOT (h ->> 'es_actual')::boolean AND (h ->> 'importe')::numeric = 5500)
       AND bool_or(NOT (h ->> 'es_actual')::boolean AND (h ->> 'importe')::numeric = 5000)
    FROM jsonb_array_elements(
      public.peajes_listar_tarifa_historial(
        '17400000-aaaa-4aa1-8aa1-000000000050'
      )
    ) h
  ),
  'F14-17 historial marca vigente 5800 y conserva 5500/5000'
);

SELECT throws_ok(
  $$SELECT public.peajes_guardar_tarifas_actuales(
      '17400000-aaaa-4aa1-8aa1-000000000001',
      '17400000-aaaa-4aa1-8aa1-000000000010',
      'IDA',
      '[{"categoria":1,"status":"NO_PICO","importe":0}]'::jsonb
    )$$,
  '23514',
  NULL,
  'F14-17 rechaza importe 0'
);

SELECT finish();
ROLLBACK;
```

Adjust `plan(N)` to the exact assertion count after you write the file.

- [ ] **Step 2: Run pgTAP and confirm RED**

Run from `ibarra-app`:

```powershell
npx supabase test db
```

Expected: FAIL — `has_function` for the four names (functions do not exist yet). If Docker is down, `npx supabase start` first, then re-run. Do not `db reset --linked`.

- [ ] **Step 3: Do not implement RPCs in this task**

The red file is the deliverable. Implementing SQL here would skip the red gate.

- [ ] **Step 4: Commit (only if the human asked)**

```powershell
git add supabase/tests/peajes_tarifario_rpc_test.sql
git commit -m "test(peajes): pgTAP red for tarifario current-price RPCs"
```

---

### Task 2: Four INVOKER RPCs (GREEN)

**Files:**
- Create: `ibarra-app/supabase/migrations/20260908140000_peajes_tarifario_rpcs.sql`
- Test: `ibarra-app/supabase/tests/peajes_tarifario_rpc_test.sql`

**Interfaces:**
- Consumes: `tarifas`, `tarifa_importe`, `peajes`, `estaciones`, `trg_tarifa_importe_promote`
- Produces: the four function signatures below (JSON keys must match the Angular contract)

- [ ] **Step 1: Keep the Task 1 tests unchanged**

If GREEN needs extra assertions (create-missing identity, bulk of three items, sentido `AMBAS`), add them to the same pgTAP file **before** writing SQL, re-run to confirm still RED, then implement.

Add these two assertions (update `plan()`):

```sql
-- create-missing on VACIA
SELECT is(
  (
    SELECT (public.peajes_guardar_tarifas_actuales(
      '17400000-aaaa-4aa1-8aa1-000000000001',
      '17400000-aaaa-4aa1-8aa1-000000000011',
      'IDA',
      '[{"categoria":4,"status":"PICO","importe":9500}]'::jsonb
    ) ->> 'actualizadas')::int
  ),
  1,
  'F14-17 guardar crea identidad faltante'
);

SELECT is(
  (
    SELECT count(*)::int FROM public.tarifas
    WHERE estacion_id = '17400000-aaaa-4aa1-8aa1-000000000011'
      AND categoria = 4 AND status = 'PICO' AND sentido = 'IDA'
  ),
  1,
  'F14-17 VACIA gana una fila tarifas'
);
```

- [ ] **Step 2: Re-run pgTAP — still RED**

```powershell
npx supabase test db
```

Expected: FAIL on missing functions.

- [ ] **Step 3: Write `20260908140000_peajes_tarifario_rpcs.sql`**

Copy this migration. Do not add CREATE TABLE.

```sql
-- F14-17 Tarifario RPCs. No DDL. Uses F14-16 tarifas + tarifa_importe.

-- -----------------------------------------------------------------------------
-- 1) List current prices only
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_listar_tarifas_actuales(
  p_filtros jsonb DEFAULT '{}'::jsonb,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_sort text DEFAULT 'estacion_nombre:asc'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);
  v_sort_raw text := lower(COALESCE(NULLIF(btrim(p_sort), ''), 'estacion_nombre:asc'));
  v_sort text := split_part(v_sort_raw, ':', 1);
  v_asc boolean := split_part(v_sort_raw, ':', 2) <> 'desc';
  v_peaje_ids uuid[];
  v_estacion_ids uuid[];
  v_categorias smallint[];
  v_status text[];
  v_sentidos text[];
  v_q text;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF v_sort NOT IN (
    'estacion_nombre', 'peaje_nombre', 'categoria', 'importe',
    'fecha_actualizacion', 'status', 'sentido'
  ) THEN
    v_sort := 'estacion_nombre';
  END IF;

  IF p_filtros ? 'peaje_ids' AND jsonb_typeof(p_filtros->'peaje_ids') = 'array' THEN
    SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_peaje_ids
    FROM jsonb_array_elements_text(p_filtros->'peaje_ids') t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_peaje_ids := ARRAY[]::uuid[];
  END IF;

  IF p_filtros ? 'estacion_ids' AND jsonb_typeof(p_filtros->'estacion_ids') = 'array' THEN
    SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO v_estacion_ids
    FROM jsonb_array_elements_text(p_filtros->'estacion_ids') t(value)
    WHERE NULLIF(value, '') IS NOT NULL;
  ELSE
    v_estacion_ids := ARRAY[]::uuid[];
  END IF;

  IF p_filtros ? 'categorias' AND jsonb_typeof(p_filtros->'categorias') = 'array' THEN
    SELECT COALESCE(array_agg(value::smallint), ARRAY[]::smallint[]) INTO v_categorias
    FROM jsonb_array_elements_text(p_filtros->'categorias') t(value)
    WHERE value ~ '^[0-9]+$';
  ELSE
    v_categorias := ARRAY[]::smallint[];
  END IF;

  IF p_filtros ? 'status' AND jsonb_typeof(p_filtros->'status') = 'array' THEN
    SELECT COALESCE(array_agg(upper(value)), ARRAY[]::text[]) INTO v_status
    FROM jsonb_array_elements_text(p_filtros->'status') t(value)
    WHERE upper(value) IN ('PICO', 'NO_PICO');
  ELSE
    v_status := ARRAY[]::text[];
  END IF;

  IF p_filtros ? 'sentidos' AND jsonb_typeof(p_filtros->'sentidos') = 'array' THEN
    SELECT COALESCE(array_agg(upper(value)), ARRAY[]::text[]) INTO v_sentidos
    FROM jsonb_array_elements_text(p_filtros->'sentidos') t(value)
    WHERE upper(value) IN ('IDA', 'VUELTA', 'AMBAS');
  ELSE
    v_sentidos := ARRAY[]::text[];
  END IF;

  v_q := NULLIF(btrim(p_filtros->>'q_estacion'), '');

  CREATE TEMP TABLE _tf_list ON COMMIT DROP AS
  SELECT
    t.id AS tarifa_id,
    t.peaje_id,
    p.nombre AS peaje_nombre,
    t.estacion_id,
    e.nombre AS estacion_nombre,
    t.categoria,
    t.status,
    t.sentido,
    ti.importe,
    t.fecha_actualizacion,
    t.current_tarifa_id AS current_tarifa_importe_id
  FROM public.tarifas t
  JOIN public.peajes p ON p.id = t.peaje_id
  JOIN public.estaciones e ON e.id = t.estacion_id
  LEFT JOIN public.tarifa_importe ti
    ON ti.id = t.current_tarifa_id AND ti.tarifa_id = t.id
  WHERE (cardinality(v_peaje_ids) = 0 OR t.peaje_id = ANY (v_peaje_ids))
    AND (cardinality(v_estacion_ids) = 0 OR t.estacion_id = ANY (v_estacion_ids))
    AND (cardinality(v_categorias) = 0 OR t.categoria = ANY (v_categorias))
    AND (cardinality(v_status) = 0 OR t.status = ANY (v_status))
    AND (cardinality(v_sentidos) = 0 OR t.sentido = ANY (v_sentidos))
    AND (v_q IS NULL OR e.nombre ILIKE '%' || v_q || '%');

  SELECT count(*) INTO v_total FROM _tf_list;

  SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT *
    FROM _tf_list
    ORDER BY
      CASE WHEN v_sort = 'estacion_nombre' AND v_asc THEN estacion_nombre END ASC,
      CASE WHEN v_sort = 'estacion_nombre' AND NOT v_asc THEN estacion_nombre END DESC,
      CASE WHEN v_sort = 'peaje_nombre' AND v_asc THEN peaje_nombre END ASC,
      CASE WHEN v_sort = 'peaje_nombre' AND NOT v_asc THEN peaje_nombre END DESC,
      CASE WHEN v_sort = 'categoria' AND v_asc THEN categoria END ASC,
      CASE WHEN v_sort = 'categoria' AND NOT v_asc THEN categoria END DESC,
      CASE WHEN v_sort = 'importe' AND v_asc THEN importe END ASC NULLS LAST,
      CASE WHEN v_sort = 'importe' AND NOT v_asc THEN importe END DESC NULLS LAST,
      CASE WHEN v_sort = 'fecha_actualizacion' AND v_asc THEN fecha_actualizacion END ASC,
      CASE WHEN v_sort = 'fecha_actualizacion' AND NOT v_asc THEN fecha_actualizacion END DESC,
      CASE WHEN v_sort = 'status' AND v_asc THEN status END ASC,
      CASE WHEN v_sort = 'status' AND NOT v_asc THEN status END DESC,
      CASE WHEN v_sort = 'sentido' AND v_asc THEN sentido END ASC,
      CASE WHEN v_sort = 'sentido' AND NOT v_asc THEN sentido END DESC,
      tarifa_id
    OFFSET (v_page - 1) * v_page_size
    LIMIT v_page_size
  ) x;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 2) Editor for one peaje + estacion + sentido
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_obtener_tarifario_editor(
  p_peaje_id uuid,
  p_estacion_id uuid,
  p_sentido text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sentido text := upper(btrim(p_sentido));
  v_peaje_nombre text;
  v_estacion_nombre text;
  v_existentes jsonb;
BEGIN
  IF v_sentido NOT IN ('IDA', 'VUELTA', 'AMBAS') THEN
    RAISE EXCEPTION 'sentido invalido: %', p_sentido USING ERRCODE = '22023';
  END IF;

  SELECT nombre INTO v_peaje_nombre FROM public.peajes WHERE id = p_peaje_id;
  SELECT nombre INTO v_estacion_nombre FROM public.estaciones WHERE id = p_estacion_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.categoria, x.status), '[]'::jsonb)
    INTO v_existentes
  FROM (
    SELECT
      t.id AS tarifa_id,
      t.categoria,
      t.status,
      t.current_tarifa_id AS current_tarifa_importe_id,
      ti.importe,
      t.fecha_actualizacion
    FROM public.tarifas t
    LEFT JOIN public.tarifa_importe ti
      ON ti.id = t.current_tarifa_id AND ti.tarifa_id = t.id
    WHERE t.peaje_id = p_peaje_id
      AND t.estacion_id = p_estacion_id
      AND t.sentido = v_sentido
  ) x;

  RETURN jsonb_build_object(
    'context', jsonb_build_object(
      'peaje_id', p_peaje_id,
      'peaje_nombre', COALESCE(v_peaje_nombre, p_peaje_id::text),
      'estacion_id', p_estacion_id,
      'estacion_nombre', COALESCE(v_estacion_nombre, p_estacion_id::text),
      'sentido', v_sentido
    ),
    'existentes', v_existentes
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 3) Bulk save: insert tarifas if missing, append tarifa_importe
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_guardar_tarifas_actuales(
  p_peaje_id uuid,
  p_estacion_id uuid,
  p_sentido text,
  p_cambios jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sentido text := upper(btrim(p_sentido));
  v_cambio jsonb;
  v_categoria smallint;
  v_status text;
  v_importe numeric;
  v_tarifa_id uuid;
  v_n integer := 0;
BEGIN
  IF v_sentido NOT IN ('IDA', 'VUELTA', 'AMBAS') THEN
    RAISE EXCEPTION 'sentido invalido: %', p_sentido USING ERRCODE = '22023';
  END IF;
  IF p_cambios IS NULL OR jsonb_typeof(p_cambios) <> 'array' THEN
    RAISE EXCEPTION 'p_cambios debe ser un array JSON' USING ERRCODE = '22023';
  END IF;

  FOR v_cambio IN SELECT value FROM jsonb_array_elements(p_cambios)
  LOOP
    v_categoria := (v_cambio->>'categoria')::smallint;
    v_status := upper(btrim(v_cambio->>'status'));
    v_importe := (v_cambio->>'importe')::numeric;

    IF v_categoria IS NULL OR v_categoria < 0 OR v_categoria > 10 THEN
      RAISE EXCEPTION 'categoria invalida: %', v_cambio->>'categoria' USING ERRCODE = '22023';
    END IF;
    IF v_status NOT IN ('PICO', 'NO_PICO') THEN
      RAISE EXCEPTION 'status invalido: %', v_cambio->>'status' USING ERRCODE = '22023';
    END IF;
    IF v_importe IS NULL OR v_importe <= 0 THEN
      RAISE EXCEPTION 'importe debe ser > 0 (F14-16 tarifa_importe_importe_chk)'
        USING ERRCODE = '23514';
    END IF;

    SELECT t.id INTO v_tarifa_id
    FROM public.tarifas t
    WHERE t.peaje_id = p_peaje_id
      AND t.estacion_id = p_estacion_id
      AND t.status = v_status
      AND t.categoria = v_categoria
      AND t.sentido = v_sentido
    FOR UPDATE;

    IF v_tarifa_id IS NULL THEN
      INSERT INTO public.tarifas (
        peaje_id, estacion_id, status, categoria, sentido,
        requiere_normalizacion_iva, current_tarifa_id, fecha_actualizacion
      ) VALUES (
        p_peaje_id, p_estacion_id, v_status, v_categoria, v_sentido,
        false, NULL, now()
      )
      RETURNING id INTO v_tarifa_id;
    END IF;

    INSERT INTO public.tarifa_importe (tarifa_id, importe, fecha_aparicion)
    VALUES (v_tarifa_id, v_importe, now());

    v_n := v_n + 1;
  END LOOP;

  RETURN jsonb_build_object('actualizadas', v_n);
END;
$$;

-- -----------------------------------------------------------------------------
-- 4) History for one tarifas.id
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peajes_listar_tarifa_historial(p_tarifa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_current uuid;
  v_rows jsonb;
BEGIN
  SELECT current_tarifa_id INTO v_current
  FROM public.tarifas
  WHERE id = p_tarifa_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.fecha_aparicion DESC, x.id DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      ti.id,
      ti.importe,
      ti.fecha_aparicion,
      (ti.id IS NOT DISTINCT FROM v_current) AS es_actual
    FROM public.tarifa_importe ti
    WHERE ti.tarifa_id = p_tarifa_id
  ) x;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.peajes_listar_tarifas_actuales(jsonb, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.peajes_obtener_tarifario_editor(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.peajes_guardar_tarifas_actuales(uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.peajes_listar_tarifa_historial(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.peajes_listar_tarifas_actuales(jsonb, integer, integer, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_obtener_tarifario_editor(uuid, uuid, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_guardar_tarifas_actuales(uuid, uuid, text, jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peajes_listar_tarifa_historial(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.peajes_listar_tarifas_actuales(jsonb, integer, integer, text) IS
  'F14-17 · Lista precios vigentes (current_tarifa_id), no todo el historial.';
COMMENT ON FUNCTION public.peajes_obtener_tarifario_editor(uuid, uuid, text) IS
  'F14-17 · Identidades de un peaje+estacion+sentido. existentes=[] es exito.';
COMMENT ON FUNCTION public.peajes_guardar_tarifas_actuales(uuid, uuid, text, jsonb) IS
  'F14-17 · Append tarifa_importe; el trigger promociona current. Crea tarifas si falta.';
COMMENT ON FUNCTION public.peajes_listar_tarifa_historial(uuid) IS
  'F14-17 · Historial de una tarifas.id con es_actual.';
```

- [ ] **Step 4: Apply locally and run pgTAP GREEN**

```powershell
npx supabase db reset --local --no-seed
npx supabase test db
```

Expected: `peajes_tarifario_rpc_test.sql` assertions PASS. The large F14-16 file must still pass (do not break promote/immutable tests). If `db reset` is too slow, `npx supabase migration up` after adding the file, then `npx supabase test db`.

- [ ] **Step 5: Commit (only if asked)**

```powershell
git add supabase/migrations/20260908140000_peajes_tarifario_rpcs.sql supabase/tests/peajes_tarifario_rpc_test.sql
git commit -m "feat(peajes): tarifario RPCs on tarifas + tarifa_importe"
```

---

### Task 3: Angular `PeajesTarifarioSupabaseService`

**Files:**
- Create: `ibarra-app/src/app/components/peajes/services/peajes-tarifario.service.ts`
- Create: `ibarra-app/src/app/components/peajes/services/peajes-tarifario.service.spec.ts`
- Modify: `ibarra-app/src/app/components/peajes/services/index.ts`

**Interfaces:**
- Consumes: `PeajesTarifarioService` from `models/tarifario.contracts.ts`; `SupabaseService.getClient` / `executeWithRetry`
- Produces: `PeajesTarifarioSupabaseService` with the four methods calling the RPC names from Task 2

- [ ] **Step 1: Write the failing spec**

Pattern: fake client whose `rpc` records name + args (same idea as `PeajesAuditoriaTarifasSupabaseService`).

```ts
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../../../services/supabase.service';
import { PeajesTarifarioSupabaseService } from './peajes-tarifario.service';

describe('PeajesTarifarioSupabaseService', () => {
  let rpcSpy: jasmine.Spy;
  let service: PeajesTarifarioSupabaseService;

  beforeEach(() => {
    rpcSpy = jasmine.createSpy('rpc').and.resolveTo({ data: { rows: [], total: 0, page: 1, page_size: 50 }, error: null });
    TestBed.configureTestingModule({
      providers: [
        PeajesTarifarioSupabaseService,
        {
          provide: SupabaseService,
          useValue: {
            executeWithRetry: (fn: () => Promise<unknown>) => fn(),
            getClient: async () => ({ rpc: rpcSpy }),
          },
        },
      ],
    });
    service = TestBed.inject(PeajesTarifarioSupabaseService);
  });

  it('listar llama peajes_listar_tarifas_actuales con filtros y pagina', async () => {
    await firstValueFrom(
      service.listar({
        filters: { sentidos: ['IDA'], q_estacion: 'HUD' },
        page: 2,
        pageSize: 25,
        sort: 'importe:desc',
      }),
    );
    expect(rpcSpy).toHaveBeenCalledWith('peajes_listar_tarifas_actuales', {
      p_filtros: { sentidos: ['IDA'], q_estacion: 'HUD' },
      p_page: 2,
      p_page_size: 25,
      p_sort: 'importe:desc',
    });
  });

  it('obtenerEditor llama peajes_obtener_tarifario_editor', async () => {
    rpcSpy.and.resolveTo({
      data: {
        context: {
          peaje_id: 'p',
          peaje_nombre: 'AUBASA',
          estacion_id: 'e',
          estacion_nombre: 'HUDSON',
          sentido: 'IDA',
        },
        existentes: [],
      },
      error: null,
    });
    const payload = await firstValueFrom(service.obtenerEditor('p', 'e', 'IDA'));
    expect(rpcSpy).toHaveBeenCalledWith('peajes_obtener_tarifario_editor', {
      p_peaje_id: 'p',
      p_estacion_id: 'e',
      p_sentido: 'IDA',
    });
    expect(payload.existentes).toEqual([]);
  });

  it('guardar envia el array de cambios sin vacios', async () => {
    rpcSpy.and.resolveTo({ data: { actualizadas: 3 }, error: null });
    const cambios = [
      { categoria: 1, status: 'NO_PICO' as const, importe: 5800 },
      { categoria: 2, status: 'NO_PICO' as const, importe: 7300 },
      { categoria: 2, status: 'PICO' as const, importe: 7900 },
    ];
    const out = await firstValueFrom(service.guardar('p', 'e', 'IDA', cambios));
    expect(rpcSpy).toHaveBeenCalledWith('peajes_guardar_tarifas_actuales', {
      p_peaje_id: 'p',
      p_estacion_id: 'e',
      p_sentido: 'IDA',
      p_cambios: cambios,
    });
    expect(out.actualizadas).toBe(3);
  });

  it('listarHistorial llama peajes_listar_tarifa_historial', async () => {
    rpcSpy.and.resolveTo({ data: [], error: null });
    await firstValueFrom(service.listarHistorial('tarifa-1'));
    expect(rpcSpy).toHaveBeenCalledWith('peajes_listar_tarifa_historial', {
      p_tarifa_id: 'tarifa-1',
    });
  });
});
```

- [ ] **Step 2: Run the spec — RED**

```powershell
pnpm exec ng test --include="**/peajes-tarifario.service.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: FAIL — `PeajesTarifarioSupabaseService` is not exported.

- [ ] **Step 3: Implement the service**

```ts
import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { SupabaseService } from '../../../services/supabase.service';
import {
  PeajesTarifarioService,
  TarifaSentido,
  TarifarioEditorPayload,
  TarifarioHistorialItem,
  TarifarioImporteCambio,
  TarifarioListParams,
  TarifarioListResult,
} from '../models/tarifario.contracts';

@Injectable({ providedIn: 'root' })
export class PeajesTarifarioSupabaseService implements PeajesTarifarioService {
  private readonly supabase = inject(SupabaseService);

  listar(params: TarifarioListParams = {}): Observable<TarifarioListResult> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 50;
        const { data, error } = await client.rpc('peajes_listar_tarifas_actuales', {
          p_filtros: params.filters ?? {},
          p_page: page,
          p_page_size: pageSize,
          p_sort: params.sort ?? 'estacion_nombre:asc',
        });
        if (error) throw error;
        return {
          rows: data?.rows ?? [],
          total: Number(data?.total ?? 0),
          page: Number(data?.page ?? page),
          pageSize: Number(data?.page_size ?? pageSize),
        };
      }),
    );
  }

  obtenerEditor(peajeId: string, estacionId: string, sentido: TarifaSentido) {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_obtener_tarifario_editor', {
          p_peaje_id: peajeId,
          p_estacion_id: estacionId,
          p_sentido: sentido,
        });
        if (error) throw error;
        return data as TarifarioEditorPayload;
      }),
    );
  }

  guardar(
    peajeId: string,
    estacionId: string,
    sentido: TarifaSentido,
    cambios: TarifarioImporteCambio[],
  ) {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_guardar_tarifas_actuales', {
          p_peaje_id: peajeId,
          p_estacion_id: estacionId,
          p_sentido: sentido,
          p_cambios: cambios,
        });
        if (error) throw error;
        return { actualizadas: Number(data?.actualizadas ?? 0) };
      }),
    );
  }

  listarHistorial(tarifaId: string): Observable<TarifarioHistorialItem[]> {
    return from(
      this.supabase.executeWithRetry(async () => {
        const client = await this.supabase.getClient();
        const { data, error } = await client.rpc('peajes_listar_tarifa_historial', {
          p_tarifa_id: tarifaId,
        });
        if (error) throw error;
        return (data ?? []) as TarifarioHistorialItem[];
      }),
    );
  }
}
```

Map numeric `importe` / `categoria` with `Number(...)` if PostgREST returns strings. Empty `existentes` must stay `[]`, not `null`.

Export from `services/index.ts`:

```ts
export { PeajesTarifarioSupabaseService } from './peajes-tarifario.service';
```

- [ ] **Step 4: Run the spec — GREEN**

```powershell
pnpm exec ng test --include="**/peajes-tarifario.service.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: TOTAL SUCCESS (4 tests).

- [ ] **Step 5: Commit (only if asked)**

```powershell
git add src/app/components/peajes/services/peajes-tarifario.service.ts src/app/components/peajes/services/peajes-tarifario.service.spec.ts src/app/components/peajes/services/index.ts
git commit -m "feat(peajes): Supabase provider for tarifario RPCs"
```

---

### Task 4: Swap the route provider

**Files:**
- Modify: `ibarra-app/src/app/components/peajes/tarifario/tarifario.routes.ts`
- Test: existing `tarifario-list.component.spec.ts` and `tarifario-editor.component.spec.ts` (they provide the mock themselves — must stay green)

**Interfaces:**
- Consumes: `PeajesTarifarioSupabaseService`
- Produces: live `/peajes/tarifario` uses RPCs

- [ ] **Step 1: Change only the provider line**

Before:

```ts
{ provide: PEAJES_TARIFARIO_SERVICE, useClass: TarifarioMockService },
```

After:

```ts
import { PeajesTarifarioSupabaseService } from '../services';

export const PEAJES_TARIFARIO_PROVIDERS: Provider[] = [
  { provide: PEAJES_CATALOGO_SERVICE, useExisting: PeajesCatalogoSupabaseService },
  { provide: PEAJES_TARIFARIO_SERVICE, useClass: PeajesTarifarioSupabaseService },
];
```

Remove the unused `TarifarioMockService` import from this file. Keep the mock file for unit tests.

- [ ] **Step 2: Re-run Tarifario component specs (still mock via TestBed)**

```powershell
pnpm exec ng test --include="**/peajes/tarifario/**/*.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: SUCCESS. Specs must keep `{ provide: PEAJES_TARIFARIO_SERVICE, useClass: TarifarioMockService }`.

- [ ] **Step 3: Smoke against local CLI**

1. `npx supabase status` — API on `:54321`.
2. `pnpm run dev:app` (local env, not DESARROLLO).
3. Login `peajes:manage`.
4. Open `/peajes/tarifario`. List shows real `tarifas` current rows (or empty message if CLI has no v2 seed).
5. Editar one `peaje+estacion+sentido`. Empty cells `—`. Save one NUEVO. Historial shows old + new.
6. Confirm IDA editor does not show VUELTA amounts.

If local has no `tarifas` rows, that is a valid empty catalog — do not invent a DESARROLLO backfill in this plan.

- [ ] **Step 4: Commit (only if asked)**

```powershell
git add src/app/components/peajes/tarifario/tarifario.routes.ts
git commit -m "feat(peajes): serve tarifario UI from Supabase RPCs"
```

---

### Task 5: Docs and F14-17 evidence

**Files:**
- Create: `ibarra-app/docs/backend/peajes/tarifario.md`
- Modify: `ibarra-app/docs/backend/peajes/index.md`
- Modify: `ibarra-app/docs/06-components/peajes/tarifario.md`
- Modify: `ibarra-app/docs/06-components/peajes/servicios-y-providers.md`
- Modify: `ibarra-app/feature_list.json`
- Modify: `ibarra-app/docs/claude-progress.md`
- Modify: `ibarra-app/docs/session-handoff.md`

**Interfaces:**
- Consumes: RPC names and JSON shapes from Tasks 2–4
- Produces: F14-17 `passing` only if CLI pgTAP + ng test + provider swap are evidenced

- [ ] **Step 1: Backend RPC doc**

`docs/backend/peajes/tarifario.md` must list:

| RPC | Args | Returns |
|-----|------|---------|
| `peajes_listar_tarifas_actuales` | `p_filtros jsonb`, `p_page`, `p_page_size`, `p_sort` | `{ rows, total, page, page_size }` |
| `peajes_obtener_tarifario_editor` | `p_peaje_id`, `p_estacion_id`, `p_sentido` | `{ context, existentes }` |
| `peajes_guardar_tarifas_actuales` | `p_peaje_id`, `p_estacion_id`, `p_sentido`, `p_cambios jsonb` | `{ actualizadas }` |
| `peajes_listar_tarifa_historial` | `p_tarifa_id` | `[{ id, importe, fecha_aparicion, es_actual }]` |

State: INVOKER; append-only; empty editor is success; `importe > 0`; no DESARROLLO.

Link it from `docs/backend/peajes/index.md`.

- [ ] **Step 2: UI + providers**

In `tarifario.md`: provider is `PeajesTarifarioSupabaseService`; mock remains for specs. In `servicios-y-providers.md`: Tarifario row Real = that class; Mock UI/tests = `TarifarioMockService`.

- [ ] **Step 3: feature_list F14-17**

Replace the mock-only verification line with:

- `npx supabase test db` includes `peajes_tarifario_rpc_test.sql`
- `pnpm exec ng test --include="**/peajes-tarifario.service.spec.ts" --watch=false --browsers=ChromeHeadless`
- `pnpm exec ng test --include="**/peajes/tarifario/**/*.spec.ts" --watch=false --browsers=ChromeHeadless`
- `tarifario.routes.ts` `useClass: PeajesTarifarioSupabaseService`

Set `status` to `passing` only after those commands were actually run in this execution. Paste verbatim counts into `evidence`. If pgTAP or ng test was not run, leave `in_progress`.

- [ ] **Step 4: Progress / handoff**

Prepend a 2026-09-08 (or actual date) note: mock is no longer the live provider; F14-16 schema reused; no DESARROLLO.

- [ ] **Step 5: Commit (only if asked)**

```powershell
git add docs feature_list.json
git commit -m "docs(peajes): F14-17 tarifario RPCs on CLI"
```

---

## Self-review

**Spec coverage**

| Requirement | Task |
|-------------|------|
| List current only | Task 1 + 2 `peajes_listar_tarifas_actuales` |
| Editor exact sentido | Task 1 + 2 `peajes_obtener_tarifario_editor` |
| Empty context success | Task 1 + 2 |
| Append-only save + create missing | Task 1 + 2 `peajes_guardar_tarifas_actuales` |
| History `es_actual` | Task 1 + 2 `peajes_listar_tarifa_historial` |
| Components stay on the token | Task 4 (one provider line) |
| Angular maps RPC names | Task 3 |
| Docs / F14-17 | Task 5 |
| No new tables / no DESARROLLO | Global constraints |

**Placeholder scan:** RPC SQL, Angular class, pgTAP fixtures, and commands are inlined. No TBD.

**Type consistency:** `p_filtros` / `p_page` / `p_page_size` / `p_sort`; `p_peaje_id` / `p_estacion_id` / `p_sentido`; `p_cambios`; `p_tarifa_id`. JSON keys `tarifa_id`, `current_tarifa_importe_id`, `existentes`, `actualizadas`, `es_actual` match `tarifario.contracts.ts`.
