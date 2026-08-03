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
"start": "ng serve",
"dev": "npx supabase start && ng serve --configuration=local",
"dev:app": "ng serve --configuration=local",
"seed:local": "…"
```

Script `pnpm seed:local` / `npm run seed:local`: aplica `seed_auth.sql` + `seed_rbac.sql` vía `psql` en el contenedor (sin `db reset`).

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
npx supabase start

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

Con `config.toml` → `[db.seed]`, un `npx supabase db reset --local` aplica automáticamente:

1. `supabase/seed_auth.sql` — usuarios Auth (hashes de DESARROLLO)
2. `supabase/seed_rbac.sql` — tablas/roles/permisos + perfil admin de Francis

---

## 2. Seeds versionados (Auth + RBAC)

Archivos canónicos (commiteados, solo DEV):

| Archivo | Contenido |
|---------|-----------|
| `supabase/seed_auth.sql` | Dump data-only del schema `auth` (usuarios, identidades, etc.) |
| `supabase/seed_rbac.sql` | Tablas host RBAC, módulos (incl. `peajes`), roles admin, perfil `francis@transporteibarra.com.ar` |

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

Luego: cerrar sesión en la app, `pnpm dev`, login con el email/password de DESARROLLO.

---

## Tras un `db reset`

```powershell
# Con seeds habilitados en config.toml (recomendado)
npx supabase db reset --local

# Si usaste --no-seed, reaplicar a mano:
docker cp supabase/seed_auth.sql supabase_db_ibarra-app:/tmp/seed_auth.sql
docker exec supabase_db_ibarra-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed_auth.sql
docker cp supabase/seed_rbac.sql supabase_db_ibarra-app:/tmp/seed_rbac.sql
docker exec supabase_db_ibarra-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed_rbac.sql
```

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
- Seed RBAC: `supabase/seed_rbac.sql`
- Módulo Peajes: [docs/modulos/peajes.md](../modulos/peajes.md)
- SQL empresas / catálogos: [docs/08-sql/peajes/empresas/](../08-sql/peajes/empresas/README.md)

---

> Última actualización: agosto 2026
