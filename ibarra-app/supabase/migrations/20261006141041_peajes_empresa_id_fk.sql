-- Only peajes changes company representation. Document/template/algorithm
-- company identifiers and the published view/RPC text contracts stay intact.
SET search_path = public, extensions, pg_catalog;

-- A view rule prevents ALTER TYPE even when the new SELECT casts back to text.
-- Snapshot dependent views (including downstream views), then recreate them in
-- dependency order without CASCADE. Preserve deployed definitions, options,
-- owners, comments, and grants rather than reverting later Power BI changes.
CREATE TEMP TABLE peajes_empresa_views ON COMMIT DROP AS
WITH RECURSIVE dependent_views AS (
  SELECT DISTINCT c.oid, 0 AS depth, ARRAY[c.oid] AS path
  FROM pg_depend d
  JOIN pg_rewrite r ON r.oid = d.objid
  JOIN pg_class c ON c.oid = r.ev_class AND c.relkind = 'v'
  WHERE d.refobjid = 'public.peajes'::regclass
    AND d.refobjsubid = (SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.peajes'::regclass AND attname = 'empresa_id')
  UNION ALL
  SELECT c.oid, v.depth + 1, v.path || c.oid
  FROM dependent_views v
  JOIN pg_depend d ON d.refobjid = v.oid
  JOIN pg_rewrite r ON r.oid = d.objid
  JOIN pg_class c ON c.oid = r.ev_class AND c.relkind = 'v'
  WHERE NOT c.oid = ANY(v.path)
)
SELECT c.oid, n.nspname, c.relname, max(v.depth) AS depth,
  pg_get_viewdef(c.oid, true) AS definition, c.reloptions,
  pg_get_userbyid(c.relowner) AS owner_name,
  coalesce(c.relacl, acldefault('r', c.relowner)) AS acl,
  obj_description(c.oid, 'pg_class') AS description
FROM dependent_views v
JOIN pg_class c ON c.oid = v.oid
JOIN pg_namespace n ON n.oid = c.relnamespace
GROUP BY c.oid, n.nspname, c.relname, c.reloptions, c.relowner, c.relacl;

CREATE TEMP TABLE peajes_empresa_view_columns ON COMMIT DROP AS
SELECT v.nspname, v.relname, a.attname,
  col_description(v.oid, a.attnum) AS description
FROM peajes_empresa_views v
JOIN pg_attribute a ON a.attrelid = v.oid AND a.attnum > 0
WHERE NOT a.attisdropped AND col_description(v.oid, a.attnum) IS NOT NULL;

DO $$
DECLARE v record;
BEGIN
  FOR v IN SELECT * FROM peajes_empresa_views ORDER BY depth DESC LOOP
    EXECUTE format('DROP VIEW %I.%I', v.nspname, v.relname);
  END LOOP;
END;
$$;

-- Use PostgreSQL's UUID input validation, which also accepts UUIDs in alternate
-- valid input formats. CASE keeps malformed input away from the UUID cast.
UPDATE public.peajes SET empresa_id = NULL
WHERE empresa_id IN ('__global__', '') OR empresa_id IS NULL;
UPDATE public.peajes p SET empresa_id = NULL
WHERE p.empresa_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.empresas e
  WHERE e.id = CASE WHEN pg_input_is_valid(p.empresa_id, 'uuid')
    THEN p.empresa_id::uuid ELSE NULL::uuid END
);
ALTER TABLE public.peajes ALTER COLUMN empresa_id TYPE uuid USING empresa_id::uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.peajes'::regclass AND conname = 'peajes_empresa_id_fkey') THEN
    ALTER TABLE public.peajes ADD CONSTRAINT peajes_empresa_id_fkey
      FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS idx_peajes_empresa_id ON public.peajes(empresa_id);
COMMENT ON COLUMN public.peajes.empresa_id IS
  'Empresa propietaria (FK empresas.id). NULL = peaje global visible a todas las empresas.';

DO $$
DECLARE v record; permission record; role_name text; definition text; c record;
BEGIN
  FOR v IN SELECT * FROM peajes_empresa_views ORDER BY depth ASC LOOP
    definition := replace(v.definition, 'emp.id::text = pj.empresa_id', 'emp.id = pj.empresa_id');
    -- Published company columns remain text, including the pwbi_pasadas CTE.
    definition := replace(definition, 'pj.empresa_id AS', 'pj.empresa_id::text AS');
    definition := regexp_replace(definition, '(\s)pj\.empresa_id,',
      '\1pj.empresa_id::text AS empresa_id,', 'g');
    EXECUTE format('CREATE VIEW %I.%I%s AS %s', v.nspname, v.relname,
      CASE WHEN v.reloptions IS NULL THEN ''
        ELSE ' WITH (' || array_to_string(v.reloptions, ', ') || ')' END,
      definition);
    EXECUTE format('ALTER VIEW %I.%I OWNER TO %I', v.nspname, v.relname, v.owner_name);
    EXECUTE format('COMMENT ON VIEW %I.%I IS %L', v.nspname, v.relname, v.description);
    -- Default privileges may differ across installations: remove them before
    -- restoring the exact previous grants (including PUBLIC/grant options).
    FOR permission IN SELECT DISTINCT x.grantee
      FROM pg_class pc CROSS JOIN LATERAL aclexplode(coalesce(pc.relacl, acldefault('r', pc.relowner))) x
      WHERE pc.oid = format('%I.%I', v.nspname, v.relname)::regclass LOOP
      role_name := CASE WHEN permission.grantee = 0 THEN 'PUBLIC'
        ELSE quote_ident(pg_get_userbyid(permission.grantee)) END;
      EXECUTE format('REVOKE ALL ON %I.%I FROM %s', v.nspname, v.relname, role_name);
    END LOOP;
    FOR permission IN SELECT * FROM aclexplode(v.acl) LOOP
      role_name := CASE WHEN permission.grantee = 0 THEN 'PUBLIC'
        ELSE quote_ident(pg_get_userbyid(permission.grantee)) END;
      EXECUTE format('GRANT %s ON %I.%I TO %s%s', permission.privilege_type,
        v.nspname, v.relname, role_name,
        CASE WHEN permission.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
    END LOOP;
  END LOOP;
  FOR c IN SELECT * FROM peajes_empresa_view_columns LOOP
    EXECUTE format('COMMENT ON COLUMN %I.%I.%I IS %L', c.nspname, c.relname, c.attname, c.description);
  END LOOP;
END;
$$;

-- CREATE OR REPLACE retains function ownership, privileges and signatures.
-- Preserve the existing RPC implementation and change only peajes joins and
-- projections; aliases/document identifiers intentionally continue as text.
DO $$
DECLARE definition text;
BEGIN
  definition := pg_get_functiondef('public.peajes_listar_tarifas_normalizadas(jsonb,integer,integer,text)'::regprocedure);
  definition := replace(definition, 'emp.id::text = pj.empresa_id', 'emp.id = pj.empresa_id');
  definition := replace(definition, 'pj.empresa_id    AS empresa_id', 'pj.empresa_id::text AS empresa_id');
  EXECUTE definition;

  definition := pg_get_functiondef('public.peajes_auditoria_estaciones_universo()'::regprocedure);
  definition := replace(definition, 'emp.id::text = p.empresa_id', 'emp.id = p.empresa_id');
  definition := replace(definition, 'p.empresa_id,', 'p.empresa_id::text,');
  definition := replace(definition, 'coalesce(emp.nombre, p.empresa_id)', 'coalesce(emp.nombre, p.empresa_id::text)');
  EXECUTE definition;

  definition := pg_get_functiondef('public.peajes_validar_alias_estacion()'::regprocedure);
  EXECUTE replace(definition, 'SELECT p.empresa_id INTO', 'SELECT p.empresa_id::text INTO');
  definition := pg_get_functiondef('public.peajes_touch_estaciones_vias_sentido()'::regprocedure);
  EXECUTE replace(definition, 'SELECT p.empresa_id INTO', 'SELECT p.empresa_id::text INTO');
END;
$$;

NOTIFY pgrst, 'reload schema';
