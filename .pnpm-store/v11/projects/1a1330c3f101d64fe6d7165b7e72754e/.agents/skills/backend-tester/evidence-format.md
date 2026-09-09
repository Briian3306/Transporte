# Evidence format — backend-tester

Examples for `feature_list.json` and `docs/claude-progress.md`.

## feature_list.json — evidence entry

```json
{
  "date": "2026-06-19",
  "type": "supabase_db_test",
  "command": "pnpm supabase test db",
  "target": "supabase/tests/database/get_oc_kanban_stats.test.sql",
  "environment": "local",
  "outcome": "passed",
  "summary": "RPC returns expected aggregates for sample fixture data"
}
```

### type values

| type | When |
|------|------|
| `supabase_db_test` | pgTAP file in `supabase/tests/database/` |
| `sql_verification` | Manual/targeted SQL on Local or DEV with recorded output |
| `rls_scenario` | Role-based access checks |
| `migration_rebuild` | Local rebuild with `pnpm supabase db reset --local --no-seed` |
| `dev_validation` | Remote validation against `edxoqshrzdqpnldktpzy` |
| `edge_function_manual` | Local or DEV Edge Function HTTP test |
| `angular_spec` | Karma/Jasmine service spec |
| `doc_review` | Documentation-only verification |

### environment values

| environment | API URL / target |
|-------------|------------------|
| `local` | `http://127.0.0.1:54321` |
| `dev` | `https://edxoqshrzdqpnldktpzy.supabase.co` |
| `production` | `https://uurlssweuhshbwpxxatw.supabase.co` (only with explicit user authorization; not a tester default) |

## docs/claude-progress.md — session block

```markdown
### Session NNN

- Verification run: `pnpm supabase test db`; `ng test --include="**/pedido.service.spec.ts"`
- Outcome: passed
- Evidence captured: yes — feature_list.json `chat-001` evidence[0]
- Environment: local + DEV (`edxoqshrzdqpnldktpzy`)
- Test files: `supabase/tests/database/aprobar_pedido_item.test.sql`, `src/app/features/pedidos/services/pedido.service.spec.ts`
- Backend doc: `docs/backend/pedidos/aprobar-pedido-item.md` (Notes updated)
```

## docs/backend/ — Testing section (Spanish)

Complete fields left as `pendiente` by `backend-documenter`:

```markdown
## Testing

| Tipo | Archivo / comando esperado | Escenario |
|------|---------------------------|-----------|
| `migration_rebuild` | `pnpm supabase db reset --local --no-seed` | Migraciones aplican sin error |
| `supabase_db_test` | `supabase/tests/database/aprobar_pedido_item.test.sql` | RPC retorna fila esperada |
| `dev_validation` | `pnpm supabase db push --linked --dry-run` | Dry-run contra DEV sin errores |

**Estado:** verificado

**Comando ejecutado:** `pnpm supabase db reset --local --no-seed`; `pnpm supabase test db`

**Resultado:** passed (2026-06-16)

**Evidencia:** `feature_list.json` → `{feature-id}` → `evidence[0]`
```
