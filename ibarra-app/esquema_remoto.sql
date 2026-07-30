


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."create_module_permissions_for_new_module"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.module_permissions (id, module_id, action_id)
  select gen_random_uuid(), NEW.id, a.id
  from public.system_actions a
  on conflict (module_id, action_id) do nothing;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."create_module_permissions_for_new_module"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- Si no vino creado por el cliente, lo forzamos al uid del usuario autenticado
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  -- también seteamos updated_at al crear
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_daily_statistics"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    INSERT INTO checklist_statistics (
        fecha, template_id, vehiculo_id, total_checklists,
        checklists_completados, checklists_con_errores, checklists_parciales,
        promedio_porcentaje_completado, promedio_items_por_checklist
    )
    SELECT 
        DATE(NEW.fecha_realizacion),
        NEW.template_id,
        NEW.vehiculo_id,
        1,
        CASE WHEN NEW.estado = 'completado' THEN 1 ELSE 0 END,
        CASE WHEN NEW.estado = 'con_errores' THEN 1 ELSE 0 END,
        CASE WHEN NEW.estado = 'parcial' THEN 1 ELSE 0 END,
        NEW.porcentaje_completado,
        NEW.total_items
    ON CONFLICT (fecha, template_id, vehiculo_id)
    DO UPDATE SET
        total_checklists = checklist_statistics.total_checklists + 1,
        checklists_completados = checklist_statistics.checklists_completados + 
            CASE WHEN NEW.estado = 'completado' THEN 1 ELSE 0 END,
        checklists_con_errores = checklist_statistics.checklists_con_errores + 
            CASE WHEN NEW.estado = 'con_errores' THEN 1 ELSE 0 END,
        checklists_parciales = checklist_statistics.checklists_parciales + 
            CASE WHEN NEW.estado = 'parcial' THEN 1 ELSE 0 END,
        promedio_porcentaje_completado = (
            checklist_statistics.promedio_porcentaje_completado * checklist_statistics.total_checklists + 
            NEW.porcentaje_completado
        ) / (checklist_statistics.total_checklists + 1),
        promedio_items_por_checklist = (
            checklist_statistics.promedio_items_por_checklist * checklist_statistics.total_checklists + 
            NEW.total_items
        ) / (checklist_statistics.total_checklists + 1),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_daily_statistics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_maquinas_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_maquinas_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sectores_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_sectores_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_profile_roles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_profile_roles_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."checklist_items_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "checklist_id" "uuid",
    "item_id" character varying(100) NOT NULL,
    "item_descripcion" "text" NOT NULL,
    "tipo_error" character varying(50) NOT NULL,
    "mensaje_error" "text" NOT NULL,
    "valor_ingresado" "text",
    "valor_esperado" "text",
    "seccion" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."checklist_items_errors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checklist_statistics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha" "date" NOT NULL,
    "template_id" "uuid",
    "vehiculo_id" "uuid",
    "total_checklists" integer DEFAULT 0,
    "checklists_completados" integer DEFAULT 0,
    "checklists_con_errores" integer DEFAULT 0,
    "checklists_parciales" integer DEFAULT 0,
    "promedio_porcentaje_completado" numeric(5,2) DEFAULT 0,
    "promedio_items_por_checklist" numeric(5,2) DEFAULT 0,
    "errores_mas_comunes" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."checklist_statistics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checklist_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "descripcion" "text",
    "version" character varying(50) DEFAULT '1.0'::character varying,
    "tipo" character varying(50) NOT NULL,
    "secciones" "jsonb" NOT NULL,
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."checklist_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checklists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid",
    "fecha_realizacion" timestamp with time zone NOT NULL,
    "fecha_creacion" timestamp with time zone DEFAULT "now"(),
    "informacion" "jsonb" NOT NULL,
    "respuestas" "jsonb" NOT NULL,
    "observaciones" "jsonb" DEFAULT '{}'::"jsonb",
    "validaciones" "jsonb" NOT NULL,
    "total_items" integer NOT NULL,
    "items_completados" integer NOT NULL,
    "items_con_error" integer DEFAULT 0,
    "items_con_advertencia" integer DEFAULT 0,
    "items_correctos" integer DEFAULT 0,
    "porcentaje_completado" numeric(5,2) NOT NULL,
    "estado" character varying(50) DEFAULT 'completado'::character varying,
    "requiere_revision" boolean DEFAULT false,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "vehiculo_id" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."checklists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."depositos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "descripcion" "text",
    "ubicacion" character varying(255),
    "responsable" character varying(255),
    "activo" boolean DEFAULT true,
    "fecha_creacion" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."depositos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incidentes_configuracion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clave" character varying(100) NOT NULL,
    "configuracion" "jsonb" NOT NULL,
    "descripcion" "text",
    "version" character varying(50) DEFAULT '1.0'::character varying,
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."incidentes_configuracion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incidentes_seguridad" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha" "date" NOT NULL,
    "hora" time without time zone NOT NULL,
    "nombre_reportante" character varying(255) NOT NULL,
    "telefono_reportante" character varying(50) NOT NULL,
    "categoria_reportante" character varying(50) NOT NULL,
    "motivo" "text" NOT NULL,
    "ubicacion" "text" NOT NULL,
    "patente" character varying(50),
    "tipo_incidente" character varying(100) NOT NULL,
    "subtipo_incidente" character varying(100) NOT NULL,
    "puntaje_total" integer NOT NULL,
    "nivel_riesgo" character varying(50) NOT NULL,
    "indicaciones_aplicadas" "jsonb" DEFAULT '[]'::"jsonb",
    "acciones_aplicadas" "jsonb" DEFAULT '[]'::"jsonb",
    "configuracion_snapshot" "jsonb",
    "estado_seguimiento" character varying(50) DEFAULT 'pendiente'::character varying,
    "comentarios_seguimiento" "jsonb" DEFAULT '[]'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."incidentes_seguridad" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maquinas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "modelo" character varying(255) NOT NULL,
    "numero_serie" character varying(255),
    "estado" character varying(50) DEFAULT 'activa'::character varying NOT NULL,
    "descripcion" "text",
    "ubicacion" character varying(255),
    "fecha_adquisicion" "date",
    "fecha_ultimo_mantenimiento" "date",
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."maquinas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."module_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid",
    "action_id" "uuid"
);


ALTER TABLE "public"."module_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."movimientos_stock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" character varying(20) NOT NULL,
    "deposito_id" "uuid" NOT NULL,
    "insumo_id" integer NOT NULL,
    "cantidad" numeric(10,2) NOT NULL,
    "fecha" timestamp with time zone DEFAULT "now"(),
    "usuario_id" character varying(255),
    "usuario_nombre" character varying(255),
    "motivo" "text" NOT NULL,
    "observaciones" "text",
    "proveedor" character varying(255),
    "numero_factura" character varying(100),
    "costo_unitario" numeric(10,2),
    "costo_total" numeric(10,2),
    "solicitante" character varying(255),
    "recurso_tipo" character varying(50),
    "recurso_id" character varying(255),
    "recurso_nombre" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "movimientos_stock_tipo_check" CHECK ((("tipo")::"text" = ANY ((ARRAY['entrada'::character varying, 'salida'::character varying])::"text"[])))
);


ALTER TABLE "public"."movimientos_stock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid",
    "module_permission_id" "uuid"
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sectores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "tipo" character varying(100) NOT NULL,
    "descripcion" "text",
    "ubicacion" character varying(255),
    "responsable" character varying(255),
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sectores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_depositos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deposito_id" "uuid" NOT NULL,
    "insumo_id" integer NOT NULL,
    "cantidad_actual" numeric(10,2) DEFAULT 0 NOT NULL,
    "cantidad_minima" numeric(10,2) DEFAULT 0 NOT NULL,
    "cantidad_maxima" numeric(10,2) DEFAULT 100 NOT NULL,
    "punto_reorden" numeric(10,2) DEFAULT 10 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_depositos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(50) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "icon" character varying(50),
    "route" character varying(100),
    "order_index" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profile_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profile_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(50) NOT NULL,
    "description" "text",
    "is_system_role" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."checklist_items_errors"
    ADD CONSTRAINT "checklist_items_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checklist_statistics"
    ADD CONSTRAINT "checklist_statistics_fecha_template_id_vehiculo_id_key" UNIQUE ("fecha", "template_id", "vehiculo_id");



ALTER TABLE ONLY "public"."checklist_statistics"
    ADD CONSTRAINT "checklist_statistics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checklist_templates"
    ADD CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checklists"
    ADD CONSTRAINT "checklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."depositos"
    ADD CONSTRAINT "depositos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incidentes_configuracion"
    ADD CONSTRAINT "incidentes_configuracion_clave_key" UNIQUE ("clave");



ALTER TABLE ONLY "public"."incidentes_configuracion"
    ADD CONSTRAINT "incidentes_configuracion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incidentes_seguridad"
    ADD CONSTRAINT "incidentes_seguridad_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maquinas"
    ADD CONSTRAINT "maquinas_numero_serie_key" UNIQUE ("numero_serie");



ALTER TABLE ONLY "public"."maquinas"
    ADD CONSTRAINT "maquinas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."module_permissions"
    ADD CONSTRAINT "module_permissions_module_id_action_id_key" UNIQUE ("module_id", "action_id");



ALTER TABLE ONLY "public"."module_permissions"
    ADD CONSTRAINT "module_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimientos_stock"
    ADD CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_module_permission_id_key" UNIQUE ("role_id", "module_permission_id");



ALTER TABLE ONLY "public"."sectores"
    ADD CONSTRAINT "sectores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_depositos"
    ADD CONSTRAINT "stock_depositos_deposito_id_insumo_id_key" UNIQUE ("deposito_id", "insumo_id");



ALTER TABLE ONLY "public"."stock_depositos"
    ADD CONSTRAINT "stock_depositos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_actions"
    ADD CONSTRAINT "system_actions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."system_actions"
    ADD CONSTRAINT "system_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_modules"
    ADD CONSTRAINT "system_modules_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."system_modules"
    ADD CONSTRAINT "system_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profile_roles"
    ADD CONSTRAINT "user_profile_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profile_roles"
    ADD CONSTRAINT "user_profile_roles_user_id_role_id_key" UNIQUE ("user_id", "role_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_checklist_items_errors_checklist" ON "public"."checklist_items_errors" USING "btree" ("checklist_id");



CREATE INDEX "idx_checklist_items_errors_tipo" ON "public"."checklist_items_errors" USING "btree" ("tipo_error");



CREATE INDEX "idx_checklist_statistics_fecha" ON "public"."checklist_statistics" USING "btree" ("fecha");



CREATE INDEX "idx_checklist_statistics_template" ON "public"."checklist_statistics" USING "btree" ("template_id");



CREATE INDEX "idx_checklist_statistics_vehiculo" ON "public"."checklist_statistics" USING "btree" ("vehiculo_id");



CREATE INDEX "idx_checklists_estado" ON "public"."checklists" USING "btree" ("estado");



CREATE INDEX "idx_checklists_fecha" ON "public"."checklists" USING "btree" ("fecha_realizacion");



CREATE INDEX "idx_checklists_requiere_revision" ON "public"."checklists" USING "btree" ("requiere_revision");



CREATE INDEX "idx_checklists_template" ON "public"."checklists" USING "btree" ("template_id");



CREATE INDEX "idx_config_clave" ON "public"."incidentes_configuracion" USING "btree" ("clave");



CREATE INDEX "idx_incidentes_created_by" ON "public"."incidentes_seguridad" USING "btree" ("created_by");



CREATE INDEX "idx_incidentes_estado" ON "public"."incidentes_seguridad" USING "btree" ("estado_seguimiento");



CREATE INDEX "idx_incidentes_fecha" ON "public"."incidentes_seguridad" USING "btree" ("fecha", "hora");



CREATE INDEX "idx_incidentes_nivel_riesgo" ON "public"."incidentes_seguridad" USING "btree" ("nivel_riesgo");



CREATE INDEX "idx_incidentes_tipo" ON "public"."incidentes_seguridad" USING "btree" ("tipo_incidente");



CREATE INDEX "idx_maquinas_activo" ON "public"."maquinas" USING "btree" ("activo");



CREATE INDEX "idx_maquinas_estado" ON "public"."maquinas" USING "btree" ("estado");



CREATE INDEX "idx_movimientos_deposito" ON "public"."movimientos_stock" USING "btree" ("deposito_id");



CREATE INDEX "idx_movimientos_fecha" ON "public"."movimientos_stock" USING "btree" ("fecha" DESC);



CREATE INDEX "idx_movimientos_insumo" ON "public"."movimientos_stock" USING "btree" ("insumo_id");



CREATE INDEX "idx_movimientos_tipo" ON "public"."movimientos_stock" USING "btree" ("tipo");



CREATE INDEX "idx_sectores_activo" ON "public"."sectores" USING "btree" ("activo");



CREATE INDEX "idx_sectores_tipo" ON "public"."sectores" USING "btree" ("tipo");



CREATE INDEX "idx_stock_deposito" ON "public"."stock_depositos" USING "btree" ("deposito_id");



CREATE INDEX "idx_stock_insumo" ON "public"."stock_depositos" USING "btree" ("insumo_id");



CREATE INDEX "idx_user_profile_roles_role_id" ON "public"."user_profile_roles" USING "btree" ("role_id");



CREATE INDEX "idx_user_profile_roles_user_id" ON "public"."user_profile_roles" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "set_created_by_trigger" BEFORE INSERT ON "public"."checklists" FOR EACH ROW EXECUTE FUNCTION "public"."set_created_by"();



CREATE OR REPLACE TRIGGER "set_updated_by_trigger" BEFORE UPDATE ON "public"."checklists" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_by"();



CREATE OR REPLACE TRIGGER "trg_after_insert_system_modules_create_permissions" AFTER INSERT ON "public"."system_modules" FOR EACH ROW EXECUTE FUNCTION "public"."create_module_permissions_for_new_module"();



CREATE OR REPLACE TRIGGER "trigger_update_daily_statistics" AFTER INSERT ON "public"."checklists" FOR EACH ROW EXECUTE FUNCTION "public"."update_daily_statistics"();



CREATE OR REPLACE TRIGGER "update_depositos_updated_at" BEFORE UPDATE ON "public"."depositos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_maquinas_updated_at" BEFORE UPDATE ON "public"."maquinas" FOR EACH ROW EXECUTE FUNCTION "public"."update_maquinas_updated_at"();



CREATE OR REPLACE TRIGGER "update_sectores_updated_at" BEFORE UPDATE ON "public"."sectores" FOR EACH ROW EXECUTE FUNCTION "public"."update_sectores_updated_at"();



CREATE OR REPLACE TRIGGER "update_stock_depositos_updated_at" BEFORE UPDATE ON "public"."stock_depositos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profile_roles_updated_at" BEFORE UPDATE ON "public"."user_profile_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_profile_roles_updated_at"();



ALTER TABLE ONLY "public"."checklist_items_errors"
    ADD CONSTRAINT "checklist_items_errors_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checklist_statistics"
    ADD CONSTRAINT "checklist_statistics_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id");



ALTER TABLE ONLY "public"."checklists"
    ADD CONSTRAINT "checklists_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id");



ALTER TABLE ONLY "public"."checklists"
    ADD CONSTRAINT "checklists_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."incidentes_seguridad"
    ADD CONSTRAINT "incidentes_seguridad_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."module_permissions"
    ADD CONSTRAINT "module_permissions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."system_actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."module_permissions"
    ADD CONSTRAINT "module_permissions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."system_modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."movimientos_stock"
    ADD CONSTRAINT "movimientos_stock_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "public"."depositos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_module_permission_id_fkey" FOREIGN KEY ("module_permission_id") REFERENCES "public"."module_permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_depositos"
    ADD CONSTRAINT "stock_depositos_deposito_id_fkey" FOREIGN KEY ("deposito_id") REFERENCES "public"."depositos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profile_roles"
    ADD CONSTRAINT "user_profile_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profile_roles"
    ADD CONSTRAINT "user_profile_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Actualizar usuarios" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Allow insert for authenticated users" ON "public"."incidentes_seguridad" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow read for authenticated users" ON "public"."incidentes_configuracion" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow read for authenticated users" ON "public"."incidentes_seguridad" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow update for authenticated users" ON "public"."incidentes_configuracion" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow update own incidents" ON "public"."incidentes_seguridad" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Allow write for authenticated users" ON "public"."incidentes_configuracion" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Creacion de checklist" ON "public"."checklists" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Creacion de estadisticas" ON "public"."checklist_statistics" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Creacion de perfiles" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable delete for users based on user_id" ON "public"."role_permissions" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."checklist_items_errors" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."checklist_templates" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."module_permissions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."role_permissions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."system_modules" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."checklist_items_errors" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."checklist_statistics" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."checklists" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."module_permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."system_actions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."system_modules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Permitir todo en depositos" ON "public"."depositos" USING (true);



CREATE POLICY "Permitir todo en movimientos_stock" ON "public"."movimientos_stock" USING (true);



CREATE POLICY "Permitir todo en stock_depositos" ON "public"."stock_depositos" USING (true);



CREATE POLICY "Policy with table joins" ON "public"."checklist_templates" FOR UPDATE USING (true);



CREATE POLICY "Users can delete user_profile_roles" ON "public"."user_profile_roles" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can insert user_profile_roles" ON "public"."user_profile_roles" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can update user_profile_roles" ON "public"."user_profile_roles" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can view user_profile_roles" ON "public"."user_profile_roles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Vista de templates" ON "public"."checklist_templates" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."checklist_items_errors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checklist_statistics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checklist_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checklists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "checklists_insert_owner" ON "public"."checklists" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "checklists_select_owner" ON "public"."checklists" FOR SELECT USING (("auth"."uid"() = "created_by"));



CREATE POLICY "checklists_service_role_all" ON "public"."checklists" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "checklists_update_owner" ON "public"."checklists" FOR UPDATE USING (("auth"."uid"() = "created_by")) WITH CHECK (("auth"."uid"() = "created_by"));



ALTER TABLE "public"."depositos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."incidentes_configuracion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."incidentes_seguridad" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maquinas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "maquinas_delete_policy" ON "public"."maquinas" FOR DELETE USING (true);



CREATE POLICY "maquinas_insert_policy" ON "public"."maquinas" FOR INSERT WITH CHECK (true);



CREATE POLICY "maquinas_select_policy" ON "public"."maquinas" FOR SELECT USING (true);



CREATE POLICY "maquinas_update_policy" ON "public"."maquinas" FOR UPDATE USING (true);



ALTER TABLE "public"."module_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."movimientos_stock" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sectores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sectores_delete_policy" ON "public"."sectores" FOR DELETE USING (true);



CREATE POLICY "sectores_insert_policy" ON "public"."sectores" FOR INSERT WITH CHECK (true);



CREATE POLICY "sectores_select_policy" ON "public"."sectores" FOR SELECT USING (true);



CREATE POLICY "sectores_update_policy" ON "public"."sectores" FOR UPDATE USING (true);



ALTER TABLE "public"."stock_depositos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_modules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profile_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."create_module_permissions_for_new_module"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_module_permissions_for_new_module"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_module_permissions_for_new_module"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_daily_statistics"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_daily_statistics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_daily_statistics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_maquinas_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_maquinas_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_maquinas_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_sectores_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_sectores_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sectores_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_profile_roles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_profile_roles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_profile_roles_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."checklist_items_errors" TO "anon";
GRANT ALL ON TABLE "public"."checklist_items_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_items_errors" TO "service_role";



GRANT ALL ON TABLE "public"."checklist_statistics" TO "anon";
GRANT ALL ON TABLE "public"."checklist_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."checklist_templates" TO "anon";
GRANT ALL ON TABLE "public"."checklist_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_templates" TO "service_role";



GRANT ALL ON TABLE "public"."checklists" TO "anon";
GRANT ALL ON TABLE "public"."checklists" TO "authenticated";
GRANT ALL ON TABLE "public"."checklists" TO "service_role";



GRANT ALL ON TABLE "public"."depositos" TO "anon";
GRANT ALL ON TABLE "public"."depositos" TO "authenticated";
GRANT ALL ON TABLE "public"."depositos" TO "service_role";



GRANT ALL ON TABLE "public"."incidentes_configuracion" TO "anon";
GRANT ALL ON TABLE "public"."incidentes_configuracion" TO "authenticated";
GRANT ALL ON TABLE "public"."incidentes_configuracion" TO "service_role";



GRANT ALL ON TABLE "public"."incidentes_seguridad" TO "anon";
GRANT ALL ON TABLE "public"."incidentes_seguridad" TO "authenticated";
GRANT ALL ON TABLE "public"."incidentes_seguridad" TO "service_role";



GRANT ALL ON TABLE "public"."maquinas" TO "anon";
GRANT ALL ON TABLE "public"."maquinas" TO "authenticated";
GRANT ALL ON TABLE "public"."maquinas" TO "service_role";



GRANT ALL ON TABLE "public"."module_permissions" TO "anon";
GRANT ALL ON TABLE "public"."module_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."module_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."movimientos_stock" TO "anon";
GRANT ALL ON TABLE "public"."movimientos_stock" TO "authenticated";
GRANT ALL ON TABLE "public"."movimientos_stock" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."sectores" TO "anon";
GRANT ALL ON TABLE "public"."sectores" TO "authenticated";
GRANT ALL ON TABLE "public"."sectores" TO "service_role";



GRANT ALL ON TABLE "public"."stock_depositos" TO "anon";
GRANT ALL ON TABLE "public"."stock_depositos" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_depositos" TO "service_role";



GRANT ALL ON TABLE "public"."system_actions" TO "anon";
GRANT ALL ON TABLE "public"."system_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."system_actions" TO "service_role";



GRANT ALL ON TABLE "public"."system_modules" TO "anon";
GRANT ALL ON TABLE "public"."system_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."system_modules" TO "service_role";



GRANT ALL ON TABLE "public"."user_profile_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_profile_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profile_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































