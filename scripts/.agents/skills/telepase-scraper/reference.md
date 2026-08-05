# Telepase scraper — quick reference

## Layout

```text
scripts/
  html/facturas                 # saved Telepase admin HTML
  telepase/                     # Node package (playwright, cheerio)
  downloads/{CONCESIONARIO}/    # PDF + CSV output
  docs/
    telepase-downloader.md
    claude-progress-script.md
  feature-list-script.json
  .agents/skills/telepase-scraper/
```

## Feature IDs

| ID | Status (2026-08-05) | Topic |
|---|---|---|
| TS00-1 | passing | Scaffold |
| TS00-2 | passing | HTML parser |
| TS01-1 | passing | Login + auth.json |
| TS01-2 | passing | Public fetch download |
| TS01-3 | passing | Auth AUSA download |
| TS01-4 | passing | Skip / retry / errors |
| TS02-1 | passing | User docs |
| TS02-2 | passing | Agent coordination + skill |
| TS03-1 | not_started | Auto-refresh HTML |
| TS03-2 | not_started | Download manifest |

## Flags cheat-sheet

```text
--no-auth              public URLs via fetch
--limit N              subset of rows
--diverse              one row per concesionario when limiting
--prefer A,B,C         prefer those codes first
--headed               headed browser (auth path)
login.mjs --force      refresh auth.json
```

## Known URL families

| Pattern | Auth |
|---|---|
| `/admin/descargar-factura-aumesa/…` | Usually public |
| `/admin/descargar-pasadas-vsfe/…` | Usually public |
| `/admin/descargar-factura/{n}/DR/AUSA-…` | Needs login |
