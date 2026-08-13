-- 05_cleanup_test.sql
-- Drop one-off staging + backup tables after successful verify.

DROP TABLE IF EXISTS public._stg_pasadas_categoria;
DROP TABLE IF EXISTS public.pasadas_categoria_bak;
