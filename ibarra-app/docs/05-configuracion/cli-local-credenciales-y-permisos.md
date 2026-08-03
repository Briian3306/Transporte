# CLI local — credenciales Auth y permisos RBAC

## Resumen

Guía para trabajar la app Angular contra **Supabase CLI** (`pnpm dev`) con los mismos usuarios de login y permisos de administrador que en **DESARROLLO**. Cubre los entornos Angular, la copia de `auth.users` y el seed local de tablas RBAC (`user_profiles`, roles, módulos).

## Índice

- [Resumen](#resumen)
- [Entornos Angular](#entornos-angular)
- [Por qué hace falta](#por-qué-hace-falta)
- [Prerrequisitos](#prerrequisitos)
- [1. Arrancar CLI + app local](#1-arrancar-cli--app-local)
- [2. Recuperar credenciales Auth (usuarios)](#2-recuperar-credenciales-auth-usuarios)
- [3. Recuperar permisos RBAC (admin / peajes)](#3-recuperar-permisos-rbac-admin--peajes)
- [4. Verificar](#4-verificar)
- [Tras un `db reset`](#tras-un-db-reset)
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
"dev:app": "ng serve --configuration=local"
```

Contrato de entornos: CLI = testing; DESARROLLO = remoto. No hay staging/prod separados en este flujo.

---

## Por qué hace falta

1. **Auth:** el CLI tiene JWT/secret propios. Copiar `supabaseUrl` / `supabaseKey` de DESARROLLO a local **no** trae usuarios.
2. **Permisos:** tras `db reset`, el CLI vacío **no** tiene tablas host RBAC (`user_profiles`, `user_roles`, `system_modules`, …). Login puede funcionar y la app igual cae en access-denied (falta `peajes:read` / rol admin).

---

## Prerrequisitos

```powershell
cd ibarra-app

# Docker Desktop en ejecución
npx supabase start

# Proyecto linkeado a DESARROLLO
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

---

## 2. Recuperar credenciales Auth (usuarios)

### Exportar desde DESARROLLO

```powershell
cd ibarra-app
npx supabase db dump --linked --data-only --schema auth -f supabase/seed_auth.local.sql
```

El archivo queda en `.gitignore` (`supabase/*.local.sql`). **No commitear.**

### Importar en CLI

`npx supabase db query --local --file …` **falla** con dumps multi-statement (`cannot insert multiple commands into a prepared statement`). Usar `psql` dentro del contenedor:

```powershell
docker cp supabase/seed_auth.local.sql supabase_db_ibarra-app:/tmp/seed_auth.local.sql
docker exec supabase_db_ibarra-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed_auth.local.sql
```

### Alternativa rápida (un solo usuario)

Studio → Authentication → Add user → mismo email/password que DESARROLLO.  
Eso **no** crea perfil ni roles; hace falta el paso 3.

---

## 3. Recuperar permisos RBAC (admin / peajes)

Aplicar el seed local de RBAC (crea tablas host si faltan, módulos/acciones/roles, perfil y roles `admin` + `administrador` para Francis):

```powershell
cd ibarra-app
docker cp supabase/seed_rbac.local.sql supabase_db_ibarra-app:/tmp/seed_rbac.local.sql
docker exec supabase_db_ibarra-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed_rbac.local.sql
```

Archivo canónico de seed: `supabase/seed_rbac.local.sql` (también `*.local.sql`, no commitear).

Incluye, entre otros:

- `system_actions`, `system_modules` (incluye `peajes`)
- `user_roles` (`admin`, `administrador`)
- `module_permissions` + `role_permissions` (todas las acciones por módulo para esos roles)
- `user_profiles` + `user_profile_roles` para `francis@transporteibarra.com.ar`
- RLS de lectura para rol `authenticated`

Para **otro** email: insertar fila en `user_profiles` con el mismo `id` que `auth.users`, y filas en `user_profile_roles` apuntando a los roles admin.

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
npx supabase db reset --local --no-seed
# Reaplicar Auth + RBAC
docker cp supabase/seed_auth.local.sql supabase_db_ibarra-app:/tmp/seed_auth.local.sql
docker exec supabase_db_ibarra-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed_auth.local.sql
docker cp supabase/seed_rbac.local.sql supabase_db_ibarra-app:/tmp/seed_rbac.local.sql
docker exec supabase_db_ibarra-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed_rbac.local.sql
```

Si no tenés el dump Auth, regenerarlo con el paso 2 (requiere link a DESARROLLO).

---

## Qué no hacer

| Incorrecto | Correcto |
|------------|----------|
| Pegar URL/anon key de DESARROLLO en el CLI esperando los mismos usuarios | Usar `environment.local.ts` + dump Auth |
| `npx supabase db query --local --file dump.sql` con dumps grandes | `docker exec … psql -f …` |
| Commitear `seed_*.local.sql` | Mantener en `.gitignore` |
| `db reset --linked` / tocar DESARROLLO para “arreglar” local | Solo seed local |
| Usar refs de OrdenCompra | Solo `kfffigvyvtzyczeiadxh` |

---

## Referencias

- Entornos (contrato): [`.agents/skills/backend-supabase-write/entornos.md`](../../.agents/skills/backend-supabase-write/entornos.md)
- Environments: `src/environments/environment.ts`, `environment.local.ts`
- Angular `local` config: `angular.json` → `build/serve` configuration `local`
- Seed RBAC: `supabase/seed_rbac.local.sql`
- Módulo Peajes: [docs/modulos/peajes.md](../modulos/peajes.md)
- SQL empresas / catálogos: [docs/08-sql/peajes/empresas/](../08-sql/peajes/empresas/README.md)

---

> Última actualización: julio 2026
