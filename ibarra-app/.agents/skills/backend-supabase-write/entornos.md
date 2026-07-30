# Entornos Supabase — Peajes / Transporte Ibarra

## Contrato vigente (Fase 0+)

Solo existen **dos** entornos para este proyecto:

```text
Supabase CLI (local)  =  testing / verificación
DESARROLLO (remoto)   =  desarrollo remoto
```

**No hay** staging ni producción separados en este flujo. No inventar un tercer entorno.

| Entorno | Rol | Project ref | API URL |
|---------|-----|-------------|---------|
| **Supabase CLI** | Testing y verificación obligatoria (rebuild, migraciones, pgTAP) | Docker + Supabase CLI | `http://127.0.0.1:54321` |
| **DESARROLLO** | Remoto de desarrollo (app Angular / validación remota) | `kfffigvyvtzyczeiadxh` | `https://kfffigvyvtzyczeiadxh.supabase.co` |

`environment.ts` apunta a DESARROLLO. Eso **no** autoriza usar DESARROLLO como sustituto del testing: todo test SQL/migración se hace contra **Supabase CLI**.

## Prohibido — refs de OrdenCompra Ibarra

**Nunca** reutilizar project refs del repo hermano OrdenCompra:

| Ref prohibido | Motivo |
|---------------|--------|
| `edxoqshrzdqpnldktpzy` | OrdenCompra (DEV hermano) — otro proyecto |
| `uurlssweuhshbwpxxatw` | OrdenCompra (PROD hermano) — otro proyecto |

Si un skill o doc heredado menciona esos refs, ignorarlos y usar la tabla de arriba.

## CLI — testing (obligatorio)

Desde `ibarra-app/` (este repo usa `npm` + `npx supabase`):

```powershell
npx supabase start
npx supabase db reset --local --no-seed
npx supabase test db
```

Aplicar migraciones con CLI local (`db reset`, `migration up`, o el flujo local del repo). **No** usar MCP remoto como fuente de verdad de testing.

Antes de cualquier comando `--linked` contra DESARROLLO:

```powershell
Get-Content supabase\.temp\project-ref
# Esperado para DESARROLLO: kfffigvyvtzyczeiadxh
```

## Flujo obligatorio para agentes 01+

```text
1. Implementar en supabase/migrations/
2. Validar SQL contra Supabase CLI (testing)
3. Registrar evidencia en feature_list.json
4. Push / link a DESARROLLO solo tras CLI verde y con autorización explícita del usuario cuando corresponda
5. Documentar en docs/08-sql/{task}/
```

## Forbidden

- Tratar DESARROLLO como entorno de testing SQL
- Reutilizar refs de OrdenCompra
- Hardcodear `service_role`, Bearer tokens o secrets en migraciones/docs
- `db reset --linked` contra el remoto DESARROLLO
- Asumir staging/prod separados
