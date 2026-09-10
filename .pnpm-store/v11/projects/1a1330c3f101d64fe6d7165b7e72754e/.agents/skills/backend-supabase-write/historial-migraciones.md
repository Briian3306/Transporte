# Migration history — CLI vs MCP timestamps

Companion to [SKILL.md](SKILL.md). Read this **before every `--linked` command** and whenever `db push` fails with version mismatch.

The version id **is the filename** in `supabase/migrations/` (`YYYYMMDDHHMMSS_name.sql`). DESARROLLO (`kfffigvyvtzyczeiadxh`) stores the same ids in `schema_migrations`.

MCP `apply_migration` often writes a **different** timestamp than the local file (example: remote `20260902194010` vs local `20260902163000`). Then `npx supabase db push --linked` fails with “Remote migration versions not found” or tries to re-apply SQL that already exists.

**Do not** call MCP `apply_migration` when the SQL file already exists locally. Use `db push --linked` so the remote id matches the filename.

Never `db reset --linked`. Never OrdenCompra project refs.

## 1. Confirm project

From `ibarra-app/`:

```powershell
Get-Content supabase\.temp\project-ref
# must be kfffigvyvtzyczeiadxh
```

If it differs: `npx supabase link --project-ref kfffigvyvtzyczeiadxh` (user authorization).

## 2. Diagnose

```powershell
npx supabase migration list --local
npx supabase migration list --linked
```

Compare version ids. Two failure modes:

- **Fix A** — remote has versions with **no** matching files in `supabase/migrations/`.
- **Fix B** — same SQL exists locally, but DESARROLLO has an extra MCP timestamp.

## 3. Fix A — remote versions missing as files

```powershell
npx supabase migration fetch --linked
```

Commit the fetched files (same version ids as remote). Prefer this over `repair --status reverted` unless you know the SQL is gone from DESARROLLO.

## 4. Fix B — MCP id ≠ filename

Mark the MCP timestamp reverted and the **filename** timestamp applied:

```powershell
npx supabase migration repair --linked --status reverted <mcp_timestamp>
npx supabase migration repair --linked --status applied <filename_timestamp>
```

Then re-run `migration list --linked` and confirm a single id per change.

## 5. Push (explicit user OK only)

```powershell
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

If **403**: `npx supabase login` with an org member that can write this project. Do not invent a second project ref. Do not fall back to MCP `apply_migration` for an existing local file.

## 6. Restore local CLI after push (or after `--no-seed`)

`--no-seed` is schema-only. Do not stop there if the app or tarifario v2 is needed.

```powershell
npx supabase start --ignore-health-check
npx supabase db reset --local --no-seed
npx supabase test db
pnpm seed:local
```

`pnpm seed:local` = Kong guard + Auth/RBAC/pasadas + `migrate-tarifario-v2.mjs --load-local`.

CLI login: `francis@transporteibarra.com.ar` / `Transporte2026`.

Kong `ERR_CONNECTION_REFUSED` on `127.0.0.1:54321`: `npx supabase stop` then `npx supabase start --ignore-health-check`. Details: [docs/05-configuracion/cli-local-credenciales-y-permisos.md](../../../docs/05-configuracion/cli-local-credenciales-y-permisos.md).
