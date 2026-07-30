# Supabase environments — Local, DEV, Production

Both `backend-supabase-write` and `backend-tester` follow the canonical workflow documented in `docs/backend/supabase/`:

```text
Local CLI  -> Producción (ID1)
```

Production receives changes only after Local and DEV validation **and explicit user authorization**.

## Projects

| Environment | Role | Project ref | API URL | CLI link |
|-------------|------|-------------|---------|----------|
| **Local CLI** | Development, destructive rebuilds, pgTAP | Docker + Supabase CLI | `http://127.0.0.1:54321` | No remote link required |
| **Producción (ID1)** | Production database | `kfffigvyvtzyczeiadxh` | `https://kfffigvyvtzyczeiadxh.supabase.co` | Only after DEV passed and user authorized |

> Old testing ref `thpgpquawvweodrkuusc` is retired (July 2026).

Angular `environments.ts` may point at production URL for deployed builds — that does **not** authorize backend writes to production.

## CLI setup — local and DEV

Run from repo root. Always use `pnpm supabase`.

```powershell
pnpm supabase login
pnpm supabase init          # skip if supabase/ already exists
pnpm supabase db reset --local --no-seed
pnpm supabase test db
```

Before any remote command with `--linked`, confirm the linked project:

```powershell
Get-Content supabase\.temp\project-ref
```

Link DEV for remote validation:

```powershell
pnpm supabase link --project-ref edxoqshrzdqpnldktpzy
Get-Content supabase\.temp\project-ref
# Must output: edxoqshrzdqpnldktpzy
```

## CLI setup — production (reference only)

Production is reference-only for agents. Use it only after Local and DEV validation passed **and** the user explicitly authorized the production action:

```powershell
pnpm supabase link --project-ref kfffigvyvtzyczeiadxh
Get-Content supabase\.temp\project-ref
# Must output: kfffigvyvtzyczeiadxh
pnpm supabase db push --linked --dry-run
```

Never run:

```powershell
pnpm supabase db reset --linked
```

when linked to `kfffigvyvtzyczeiadxh`.

## Mandatory flow

```text
1. Read feature_list.json → id = {task}
2. Read docs/backend/supabase/backend-workflow.md
3. Implement structural changes in supabase/migrations/
4. Rebuild local schema and run tests
5. Link and push to DEV (dry-run first)
6. Validate app/API against https://edxoqshrzdqpnldktpzy.supabase.co
7. Write docs/08-sql/{task}/*.md with exact SQL / migration notes
8. backend-documenter → docs/backend/
9. backend-tester → evidence in feature_list.json and docs/claude-progress.md
10. Production push only after DEV passed and the user explicitly authorized it
```

## Forbidden

- Pushing or deploying to production without explicit user authorization in the current conversation
- `db reset --linked` on production
- Hardcoding production URLs, Bearer tokens, or `service_role` keys in migrations
- Committing sensitive `supabase/seed.sql`
