# Copia de seguridad del CLI local

## Resumen

Cómo guardar los datos del Supabase CLI y reconstruirlos en local para probar la app. El remoto DESARROLLO (`kfffigvyvtzyczeiadxh`) no se modifica: no hay `db push`, `db dump --linked` ni `db reset --linked`.

## Índice

- [Resumen](#resumen)
- [Qué cubre](#qué-cubre)
- [Copia](#copia)
- [Reconstruir el CLI](#reconstruir-el-cli)
- [Probar con pnpm dev](#probar-con-pnpm-dev)
- [Qué no hacer](#qué-no-hacer)
- [Referencias](#referencias)

## Qué cubre

La copia es un volcado **solo de datos** de los esquemas `public` y `auth`. El esquema vive en `supabase/migrations/`. El archivo queda en `supabase/*.local.sql`, que ya está en `.gitignore`.

`pg_dump` puede avisar de claves foráneas circulares (`tarifas` / `tarifa_importe`, `deposito_ubicaciones`). Ese SQL no se restaura con un `psql` directo. Para volver a armar el CLI se usa `db reset --local`, que aplica migraciones y los seeds de `supabase/config.toml`.

## Copia

Docker Desktop encendido y el CLI arriba (`npx supabase start --ignore-health-check` si hace falta). Desde `ibarra-app`:

```powershell
npx supabase db dump --local --data-only --schema public,auth -f supabase/backup-cli-YYYYMMDD.local.sql
```

## Reconstruir el CLI

```powershell
cd ibarra-app
npx supabase db reset --local
```

Borra la base local, reaplica las migraciones y carga los seeds (Auth, RBAC, peajes, pasadas). No toca DESARROLLO.

Comprobación:

```powershell
npx supabase db query --local "select (select count(*) from auth.users) as users, (select count(*) from public.pasadas) as pasadas;"
```

## Probar con pnpm dev

`pnpm start` apunta a DESARROLLO. `pnpm dev` apunta al CLI (`http://127.0.0.1:54321`). Los dos usan el puerto 4200: hay que parar el que esté corriendo antes de levantar el otro.

```powershell
cd ibarra-app
pnpm dev
```

- App: http://localhost:4200
- Studio: http://127.0.0.1:54323
- Login CLI: `francis@transporteibarra.com.ar` / `Transporte2026`

`pnpm dev` corre `scripts/ensure-supabase-local.mjs` y luego `dev:app` (`sync-env` en modo `local` + `ng serve --configuration=local`).

## Qué no hacer

| Incorrecto | Correcto |
|------------|----------|
| `npx supabase db push --linked` | Dejar DESARROLLO como está |
| `npx supabase db reset --linked` | `npx supabase db reset --local` |
| Restaurar el `.local.sql` con `psql` sobre el CLI | `npx supabase db reset --local` |
| `pnpm start` para probar estos datos | `pnpm dev` |

## Referencias

- Login, seeds y Kong: [cli-local-credenciales-y-permisos.md](./cli-local-credenciales-y-permisos.md)
- Flujo de migraciones (push a DESARROLLO solo con autorización aparte): [backend-workflow.md](../backend/supabase/backend-workflow.md)
- Seeds: `supabase/config.toml` → `[db.seed]`
- Entornos Angular: `src/environments/environment.local.ts`, `.env.local`

---

> Última actualización: noviembre 2026
