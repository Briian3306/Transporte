# CLI local — credenciales Auth y permisos RBAC

## Resumen

Guía para trabajar la app Angular contra **Supabase CLI** (`pnpm dev`) con los mismos usuarios de login y permisos de administrador que en **DESARROLLO**. Los seeds de Auth y RBAC están **versionados en el repo** (solo desarrollo).

## Índice

- [Resumen](#resumen)
- [Entornos Angular](#entornos-angular)
- [Por qué hace falta](#por-qué-hace-falta)
- [Prerrequisitos](#prerrequisitos)
- [1. Arrancar CLI + app local](#1-arrancar-cli--app-local)
- [2. Seeds versionados (Auth + RBAC)](#2-seeds-versionados-auth--rbac)
- [3. Aplicar seeds manualmente](#3-aplicar-seeds-manualmente)
- [4. Verificar](#4-verificar)
- [Tras un `db reset`](#tras-un-db-reset)
- [Kong caído / ERR_CONNECTION_REFUSED](#kong-caído--err_connection_refused)
- [Regenerar dump Auth desde DESARROLLO](#regenerar-dump-auth-desde-desarrollo)
- [Qué no hacer](#qué-no-hacer)
- [Referencias](#referencias)

---

## Entornos Angular

| Comando | Config Angular | Archivo | Supabase |
|---------|----------------|---------|----------|
| `pnpm start` / `ng serve` | `development` (default) | `src/environments/environment.ts` | **DESARROLLO** remoto `kfffigvyvtzyczeiadxh` |
| `pnpm dev` | `local` | `src/environments/environment.local.ts` | **CLI** `http://127.0.0.1:54321` |
| `pnpm run dev:app` | `local` | idem | CLI (asume Docker ya arriba) |

Scripts en `package.json`:

```json
"dev": "node scripts/ensure-supabase-local.mjs && npm run dev:app",
"dev:app": "node scripts/sync-env.mjs local && ng serve --configuration=local",
"supabase:start": "npx supabase start --ignore-health-check",
"seed:local": "node scripts/ensure-supabase-local.mjs && node scripts/seed-local.mjs"
```

`pnpm dev` y `pnpm seed:local` **primero** corren `scripts/ensure-supabase-local.mjs`: si Kong responde en `http://127.0.0.1:54321/auth/v1/health`, no tocan el stack; si no, hacen `supabase stop` y `supabase start --ignore-health-check` (Studio a veces queda unhealthy y un `start` sin ese flag da rollback y Kong vuelve a morir).

Luego `seed-local.mjs` aplica Auth/RBAC + catálogos + pasadas vía `psql` (sin `db reset`). **Salta** `seed_auth.sql` solo si ya existe `francis@transporteibarra.com.ar` (el dump no es idempotente). **Siempre** aplica `seed_cli_login.sql` (password CLI `Transporte2026`) y al final `migrate-tarifario-v2.mjs --load-local` (catálogo `tarifas` / `tarifa_importe`; no es un SQL de `[db.seed]`). Para recrear Auth desde cero: `npx supabase db reset --local` y otra vez `pnpm seed:local`.

Contrato de entornos: CLI = testing; DESARROLLO = remoto. No hay staging/prod separados en este flujo.

---

## Por qué hace falta

1. **Auth:** el CLI tiene JWT/secret propios. Copiar `supabaseUrl` / `supabaseKey` de DESARROLLO a local **no** trae usuarios.
2. **Permisos:** tras migraciones solas, el CLI puede no tener tablas host RBAC completas (`user_profiles`, `user_roles`, `system_modules`, …). Login puede funcionar y la app igual cae en access-denied (falta `peajes:read` / rol admin).

---

## Prerrequisitos

```powershell
cd ibarra-app

# Docker Desktop en ejecución
npx supabase start --ignore-health-check
# o: pnpm seed:local  (levanta Kong si hace falta y aplica seeds)

# Proyecto linkeado a DESARROLLO (solo si vas a regenerar dumps)
Get-Content supabase\.temp\project-ref
# Esperado: kfffigvyvtzyczeiadxh
```

Si el ref no coincide: `npx supabase link --project-ref kfffigvyvtzyczeiadxh`.

---

## 1. Arrancar CLI + app local

```powershell
cd ibarra-app
pnpm dev
# o: npm run dev
```

Studio local: http://127.0.0.1:54323  
API local: http://127.0.0.1:54321  

Con `config.toml` → `[db.seed]`, un `npx supabase db reset --local` (sin `--no-seed`) aplica automáticamente:

1. `supabase/seed_auth.sql` — usuarios Auth (hashes de DESARROLLO)
2. `supabase/seed_cli_login.sql` — fija login CLI `francis@transporteibarra.com.ar` / `Transporte2026`
3. `supabase/seed_rbac_schema.sql` + `supabase/seed_rbac.sql` — tablas/roles/permisos + perfil admin de Francis
4. `supabase/seed_peajes_desarrollo.sql` — empresas (24) y peajes (22) de DESARROLLO.
5. `supabase/seed_peajes_pasadas_fks.sql` — patentes, pases, estaciones, documentos y tarifas con los UUID de DESARROLLO (necesarios para las FK de pasadas).
6. `supabase/pasadas_rows.sql` — pasadas DESARROLLO (~8326), un solo `INSERT` por lotes + `ON CONFLICT (id) DO NOTHING`.
7. `supabase/seed_peajes_f14.sql` — peaje/estaciones/pasadas sintéticas + recálculo para `/peajes/auditoria-tarifas`

Los tests pgTAP siguen usando `npx supabase db reset --local --no-seed` para no mezclar este fixture. Después de ese reset, si vas a usar la app o el tarifario v2, **obligatorio** `pnpm seed:local` (incluye `--load-local`). Nunca `db reset --linked`.

---

## 2. Seeds versionados (Auth + RBAC)

Archivos canónicos (commiteados, solo DEV):

| Archivo | Contenido |
|---------|-----------|
| `supabase/seed_auth.sql` | Dump data-only del schema `auth` (usuarios, identidades, etc.) |
| `supabase/seed_cli_login.sql` | Password CLI conocida para Francis (bcrypt local). Solo CLI. |
| `supabase/seed_rbac.sql` | Tablas host RBAC, módulos (incl. `peajes`), roles admin, perfil `francis@transporteibarra.com.ar` |
| `supabase/seed_peajes_desarrollo.sql` | Empresas y peajes DESARROLLO (MCP). |
| `supabase/seed_peajes_pasadas_fks.sql` | Catálogos padre (UUID DESARROLLO) para que `pasadas_rows.sql` respete FK |
| `supabase/pasadas_rows.sql` | Pasadas DESARROLLO (~8326). Regenerar padres: `node scripts/generate-peajes-pasadas-fk-seed.mjs` |
| `supabase/seed_peajes_f14.sql` | Fixture F14: 80 pasadas Patrón A, dos estaciones, recálculo de tarifas |

Dumps ad-hoc con sufijo `.local.sql` siguen en `.gitignore` por si regenerás sin pisar el canónico.

`seed_rbac.sql` incluye, entre otros:

- `system_actions`, `system_modules` (incluye `peajes`)
- `user_roles` (`admin`, `administrador`)
- `module_permissions` + `role_permissions` (todas las acciones por módulo para esos roles)
- `user_profiles` + `user_profile_roles` para `francis@transporteibarra.com.ar`
- RLS de lectura para rol `authenticated`

Para **otro** email: insertar fila en `user_profiles` con el mismo `id` que `auth.users`, y filas en `user_profile_roles` apuntando a los roles admin.

---

## 3. Aplicar seeds manualmente

Útil si el stack ya está arriba y no querés un `db reset` completo.

`npx supabase db query --local --file …` **falla** con dumps multi-statement (`cannot insert multiple commands into a prepared statement`). Usar `psql` dentro del contenedor:

```powershell
cd ibarra-app

docker cp supabase/seed_auth.sql supabase_db_ibarra-app:/tmp/seed_auth.sql
docker exec supabase_db_ibarra-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed_auth.sql

docker cp supabase/seed_rbac.sql supabase_db_ibarra-app:/tmp/seed_rbac.sql
docker exec supabase_db_ibarra-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed_rbac.sql
```

### Alternativa rápida (un solo usuario)

Studio → Authentication → Add user → mismo email/password que DESARROLLO.  
Eso **no** crea perfil ni roles; hace falta aplicar `seed_rbac.sql` (y alinear el `id` del perfil).

---

## 4. Verificar

Una sola sentencia por llamada a `db query`:

```powershell
npx supabase db query --local "select count(*)::int as users from auth.users;"

npx supabase db query --local "select p.email, r.name as role from user_profiles p join user_profile_roles upr on upr.user_id = p.id join user_roles r on r.id = upr.role_id where p.email = 'francis@transporteibarra.com.ar' order by r.name;"

npx supabase db query --local "select count(*)::int as peajes_admin_perms from role_permissions rp join module_permissions mp on mp.id = rp.module_permission_id join system_modules m on m.id = mp.module_id join user_roles r on r.id = rp.role_id where m.name = 'peajes' and r.name = 'admin';"
```

Luego: cerrar sesión en la app, `pnpm dev`, login con `francis@transporteibarra.com.ar` / `Transporte2026`. En `/peajes/auditoria-tarifas` debe aparecer el peaje **CLI Auditoría tarifas**.

---

## Tras un `db reset`

```powershell
# Schema + pgTAP (vacía Auth, pasadas y tarifas v2)
npx supabase db reset --local --no-seed
npx supabase test db

# Restaurar datos de app (Auth + pasadas + tarifario v2 ETL)
pnpm seed:local
```

`pnpm seed:local` ya corre `node scripts/peajes-catalogo-audit/migrate-tarifario-v2.mjs --load-local`. No hace falta un `db reset --local` con seed de `config.toml` si usás este script.

---

## Kong caído / ERR_CONNECTION_REFUSED

Síntoma en la app (`pnpm dev` → CLI `http://127.0.0.1:54321`):

- Consola: `POST …/auth/v1/token?grant_type=password` → **`net::ERR_CONNECTION_REFUSED`**
- `AuthRetryableFetchError: Failed to fetch`
- `npx supabase status` muestra `Stopped services: [supabase_kong_ibarra-app supabase_rest_ibarra-app supabase_studio_ibarra-app …]` y a la vez `supabase local development setup is running`

Causa: Postgres (y a veces Auth) siguen arriba; **Kong** (puerto 54321) está Exited. El CLI cree que el stack ya corre porque existe el contenedor de DB. Volver a ejecutar `npx supabase start` en ese estado **no repara Kong** y puede apagar el resto de servicios. Sembrar usuarios (`seed:local`) no alcanza: sin Kong el login nunca llega a GoTrue.

La password CLI **no** es el email. Es:

```text
francis@transporteibarra.com.ar
Transporte2026
```

`.env.local` debe tener `NG_APP_SUPABASE_URL=http://127.0.0.1:54321` y la anon key **local** de `npx supabase status` (no la URL de DESARROLLO). Una key incorrecta da 401, no connection refused.

### Qué hacer (en este orden)

```powershell
cd ibarra-app

# 1) No repetir `supabase start` si ya dice "already running".
npx supabase stop
npx supabase start --ignore-health-check

# 2) Kong y Studio vivos
#    http://127.0.0.1:54321/auth/v1/health  → 200
#    http://127.0.0.1:54323                 → Studio

# 3) Login + RBAC + catálogos (ensure-supabase-local corre solo)
pnpm seed:local

# 4) En el browser: borrar datos del origen localhost (refresh token viejo)
#    Login con Transporte2026
```

`--ignore-health-check` evita que un timeout de Studio (Next.js unhealthy) haga rollback de todo el stack, incluido Kong.

Si Kong sigue caído:

```powershell
npx supabase stop --no-backup
npx supabase start --ignore-health-check
npx supabase db reset --local
```

`--no-backup` y `db reset --local` **borran** datos locales no versionados. Nunca `db reset --linked`.

`pnpm seed:local` ya incluye el ensure de Kong; no hace falta un `supabase start` extra si el health de Auth responde.

---

## Regenerar dump Auth desde DESARROLLO

Solo cuando cambien usuarios en el remoto y quieras actualizar el seed versionado:

```powershell
cd ibarra-app
npx supabase link --project-ref kfffigvyvtzyczeiadxh -p "DB_PASSWORD"
npx supabase db dump --linked --data-only --schema auth -f supabase/seed_auth.sql
```

Revisar el diff y commitear si corresponde (entorno de desarrollo).

---

## Qué no hacer

| Incorrecto | Correcto |
|------------|----------|
| Pegar URL/anon key de DESARROLLO en el CLI esperando los mismos usuarios | Usar `environment.local.ts` + `seed_auth.sql` / `seed_rbac.sql` |
| `npx supabase start` otra vez cuando status dice “already running” y Kong está Exited | `npx supabase stop` y luego `npx supabase start --ignore-health-check` (o `pnpm seed:local`) |
| Login CLI con password = email | `francis@transporteibarra.com.ar` / `Transporte2026` |
| `npx supabase db query --local --file dump.sql` con dumps grandes | `docker exec … psql -f …` |
| `db reset --linked` / tocar DESARROLLO para “arreglar” local | Solo seed local |
| Usar refs de OrdenCompra | Solo `kfffigvyvtzyczeiadxh` |
| Tratar estos seeds como aptos para producción | Solo CLI / desarrollo |

---

## Referencias

- Entornos (contrato): [`.agents/skills/backend-supabase-write/entornos.md`](../../.agents/skills/backend-supabase-write/entornos.md)
- Environments: `src/environments/environment.ts`, `environment.local.ts`
- Angular `local` config: `angular.json` → `build/serve` configuration `local`
- Seed Auth: `supabase/seed_auth.sql`
- Seed CLI login: `supabase/seed_cli_login.sql`
- Seed RBAC: `supabase/seed_rbac.sql`
- Guard del stack: `scripts/ensure-supabase-local.mjs` (`pnpm dev` y `pnpm seed:local`)
- Módulo Peajes: [docs/modulos/peajes.md](../modulos/peajes.md)
- SQL empresas / catálogos: consultar `supabase/migrations/` y los servicios de dominio.

---

> Última actualización: septiembre 2026
